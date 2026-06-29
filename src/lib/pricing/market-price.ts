import "server-only";

import { searchEbayListings } from "@/lib/ebay/browse";
import { resolveMarketplaceConfig, type EbayMarketplaceId } from "@/lib/ebay/marketplace";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — keeps eBay API usage low.
const MIN_SAMPLE = 3; // Don't trust an "average" built on too few competitors.
const SEARCH_LIMIT = 25;
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "new", "set", "pack", "pcs", "pc", "x", "uk", "us",
  "free", "hot", "sale", "premium", "quality", "high", "best", "of", "to", "in",
]);

export interface MarketAverage {
  average: number; // robust competitor price (median-based) in marketplace currency
  sampleSize: number;
  currency: string;
}

/**
 * Build a short, focused search query from a product title so the eBay search
 * returns genuinely comparable listings (not a long noisy title that matches
 * nothing). Keeps the first few meaningful words.
 */
export function buildMarketQuery(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));

  const query = words.slice(0, 6).join(" ").trim();
  return query.length >= 2 ? query : title.trim().slice(0, 60);
}

function cacheKey(query: string, marketplaceId: EbayMarketplaceId): string {
  return `${marketplaceId}::${query.toLowerCase().trim()}`;
}

/** Trimmed mean + median of competitor total prices, dropping extreme outliers. */
function summarizePrices(prices: number[]): { average: number; median: number } {
  const sorted = prices.filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return { average: 0, median: 0 };

  // Drop the cheapest/most-expensive 10% to ignore broken or premium outliers.
  const trim = Math.floor(sorted.length * 0.1);
  const trimmed = sorted.length > 4 ? sorted.slice(trim, sorted.length - trim) : sorted;
  const pool = trimmed.length > 0 ? trimmed : sorted;

  const mean = pool.reduce((sum, p) => sum + p, 0) / pool.length;
  const median = pool[Math.floor(pool.length / 2)];
  return {
    average: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
  };
}

async function readCache(key: string): Promise<MarketAverage | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("market_price_cache")
      .select("median_price, avg_price, sample_size, currency, fetched_at")
      .eq("cache_key", key)
      .maybeSingle();

    if (error || !data) return null;
    if (Date.now() - new Date(String(data.fetched_at)).getTime() > CACHE_TTL_MS) return null;

    const average = Number(data.median_price) || Number(data.avg_price) || 0;
    if (average <= 0) return null;

    return {
      average,
      sampleSize: Number(data.sample_size) || 0,
      currency: String(data.currency) || "GBP",
    };
  } catch {
    return null;
  }
}

async function writeCache(
  key: string,
  query: string,
  marketplaceId: EbayMarketplaceId,
  summary: { average: number; median: number },
  sampleSize: number,
  currency: string,
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("market_price_cache").upsert(
      {
        cache_key: key,
        marketplace_id: marketplaceId,
        query,
        avg_price: summary.average,
        median_price: summary.median,
        sample_size: sampleSize,
        currency,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" },
    );
  } catch {
    // Caching is best-effort; pricing still works without it.
  }
}

/**
 * Returns the average competitor selling price on eBay for a product, using a
 * single Browse API call (enrichDetails disabled) and a 24h cache shared across
 * sellers. Never throws — returns null when there isn't enough data so callers
 * can safely fall back to normal profit-based pricing.
 */
export async function getMarketAveragePrice(
  title: string,
  marketplaceId: EbayMarketplaceId,
): Promise<MarketAverage | null> {
  const query = buildMarketQuery(title);
  if (query.length < 2) return null;

  const key = cacheKey(query, marketplaceId);

  const cached = await readCache(key);
  if (cached) return cached;

  const fallbackCurrency = resolveMarketplaceConfig(marketplaceId).currency;

  try {
    const result = await searchEbayListings({
      query,
      limit: SEARCH_LIMIT,
      sort: "asc",
      enrichDetails: false, // single API call — no per-item detail fetches
      marketplaceId,
    });

    const prices = result.listings.map((listing) => listing.totalPrice);
    if (prices.length < MIN_SAMPLE) return null;

    const summary = summarizePrices(prices);
    if (summary.median <= 0 && summary.average <= 0) return null;

    const currency = result.listings[0]?.currency ?? fallbackCurrency;
    await writeCache(key, query, marketplaceId, summary, prices.length, currency);

    return {
      average: summary.median > 0 ? summary.median : summary.average,
      sampleSize: prices.length,
      currency,
    };
  } catch {
    return null;
  }
}
