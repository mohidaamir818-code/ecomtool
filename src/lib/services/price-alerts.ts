import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { PriceAlert, ProductSnapshot, ScrapedProduct } from "@/types/product";

export async function saveProductSnapshot(product: ScrapedProduct) {
  const client = getSupabaseAdmin();

  const { data, error } = await client
    .from("product_snapshots")
    .insert({
      source: product.source,
      external_id: product.externalId,
      title: product.title,
      price: product.price,
      currency: product.currency,
      url: product.url,
      scraped_at: product.scrapedAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save product snapshot: ${error.message}`);
  }

  return data;
}

export async function getRecentSnapshots(limit = 20): Promise<ProductSnapshot[]> {
  const client = getSupabaseAdmin();

  const { data, error } = await client
    .from("product_snapshots")
    .select("*")
    .order("scraped_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch product snapshots: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    source: row.source,
    externalId: row.external_id,
    title: row.title,
    price: row.price,
    currency: row.currency,
    url: row.url,
    scrapedAt: new Date(row.scraped_at),
  }));
}

export function detectPriceDrop(
  previousPrice: number,
  currentPrice: number,
  thresholdPercent = 5,
): PriceAlert | null {
  if (previousPrice <= 0 || currentPrice >= previousPrice) {
    return null;
  }

  const dropPercent = ((previousPrice - currentPrice) / previousPrice) * 100;

  if (dropPercent < thresholdPercent) {
    return null;
  }

  return {
    productId: "",
    previousPrice,
    currentPrice,
    dropPercent,
  };
}
