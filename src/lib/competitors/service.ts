import "server-only";

import { searchAmazefProducts } from "@/lib/amazef/client";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { CompetitorCheck, CompetitorMatch } from "@/types/competitor";

function formatPrice(price: number, currency: string): string {
  if (currency === "GBP") return `£${price.toFixed(2)}`;
  if (currency === "USD") return `$${price.toFixed(2)}`;
  if (currency === "EUR") return `€${price.toFixed(2)}`;
  return `${currency} ${price.toFixed(2)}`;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString();
}

function mapRowToCheck(row: Record<string, unknown>): CompetitorCheck {
  const currency = String(row.currency ?? "GBP");
  const userPrice = Number(row.user_price);

  return {
    id: String(row.id),
    productQuery: String(row.product_query),
    userPrice,
    userPriceLabel: formatPrice(userPrice, currency),
    currency,
    matchesFound: Number(row.matches_found ?? 0),
    productsSearched: Number(row.products_searched ?? 0),
    checkedAt: formatRelativeTime(String(row.created_at)),
  };
}

export async function getRecentCompetitorChecks(
  userId: string,
  limit = 10,
): Promise<CompetitorCheck[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("competitor_checks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map(mapRowToCheck);
}

function buildCheckMessage(
  check: CompetitorCheck,
  totalSearched: number,
): string {
  if (totalSearched === 0) {
    return `No products found matching "${check.productQuery}". Try a shorter keyword or product name.`;
  }

  if (check.matchesFound > 0) {
    return `Found ${check.matchesFound} seller${check.matchesFound === 1 ? "" : "s"} selling under your ${check.userPriceLabel} price.`;
  }

  return `There is no one selling under your ${check.userPriceLabel} price.`;
}

function mapRowToMatch(row: Record<string, unknown>, userPrice: number): CompetitorMatch {
  const currency = String(row.currency ?? "GBP");
  const price = Number(row.competitor_price);
  const priceDifference = userPrice - price;
  const externalId = row.external_product_id ? String(row.external_product_id) : String(row.id);

  return {
    id: externalId,
    productName: String(row.product_name),
    price,
    priceLabel: formatPrice(price, currency),
    currency,
    priceDifference,
    priceDifferenceLabel: formatPrice(priceDifference, currency),
    imageUrl: row.image_url ? String(row.image_url) : null,
    productUrl: row.product_url
      ? String(row.product_url)
      : `https://amazef.com/products/${externalId}`,
  };
}

export async function getCompetitorCheckDetails(
  userId: string,
  checkId: string,
): Promise<{
  check: CompetitorCheck;
  matches: CompetitorMatch[];
  message: string;
  userPriceLabel: string;
  totalSearched: number;
}> {
  const supabase = getSupabaseAdmin();

  const { data: checkRow, error: checkError } = await supabase
    .from("competitor_checks")
    .select("*")
    .eq("id", checkId)
    .eq("user_id", userId)
    .single();

  if (checkError) {
    throw new Error(checkError.message.includes("does not exist")
      ? "Competitor tables missing. Run supabase/migrations/006_competitor_checks.sql in Supabase SQL Editor."
      : "Competitor check not found.");
  }

  const check = mapRowToCheck(checkRow);
  const userPrice = Number(checkRow.user_price);

  const { data: matchRows, error: matchError } = await supabase
    .from("competitor_matches")
    .select("*")
    .eq("check_id", checkId)
    .order("competitor_price", { ascending: true });

  if (matchError && !matchError.message.includes("does not exist")) {
    throw new Error(matchError.message);
  }

  const matches = (matchRows ?? []).map((row) => mapRowToMatch(row, userPrice));
  const totalSearched = Number(checkRow.products_searched ?? 0);

  return {
    check,
    matches,
    message: buildCheckMessage(check, totalSearched),
    userPriceLabel: check.userPriceLabel,
    totalSearched,
  };
}

export async function countCompetitorChecksThisWeek(userId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("competitor_checks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", weekStart.toISOString());

  if (error) {
    if (error.message.includes("does not exist")) return 0;
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function runCompetitorCheck(
  userId: string,
  productQuery: string,
  userPrice: number,
): Promise<{
  message: string;
  currency: string;
  userPriceLabel: string;
  matches: CompetitorMatch[];
  totalSearched: number;
  check: CompetitorCheck;
}> {
  const query = productQuery.trim();
  const products = await searchAmazefProducts(query, 7, { skipLookback: true });
  const currency = products[0]?.currency ?? "GBP";
  const userPriceLabel = formatPrice(userPrice, currency);

  const cheaperProducts = products
    .filter((product) => product.price > 0 && product.price < userPrice)
    .sort((a, b) => a.price - b.price);

  const matches: CompetitorMatch[] = cheaperProducts.map((product) => {
    const priceDifference = userPrice - product.price;

    return {
      id: product.id,
      productName: product.title,
      price: product.price,
      priceLabel: formatPrice(product.price, product.currency),
      currency: product.currency,
      priceDifference,
      priceDifferenceLabel: formatPrice(priceDifference, product.currency),
      imageUrl: product.imageUrl,
      productUrl: product.productUrl,
    };
  });

  const supabase = getSupabaseAdmin();

  const { data: checkRow, error: checkError } = await supabase
    .from("competitor_checks")
    .insert({
      user_id: userId,
      product_query: query,
      user_price: userPrice,
      currency,
      matches_found: matches.length,
      products_searched: products.length,
    })
    .select()
    .single();

  if (checkError) {
    throw new Error(
      checkError.message.includes("does not exist")
        ? "Competitor tables missing. Run supabase/migrations/006_competitor_checks.sql in Supabase SQL Editor."
        : checkError.message,
    );
  }

  if (matches.length > 0) {
    const { error: matchError } = await supabase.from("competitor_matches").insert(
      matches.map((match) => ({
        check_id: checkRow.id,
        external_product_id: match.id,
        product_name: match.productName,
        competitor_price: match.price,
        currency: match.currency,
        image_url: match.imageUrl,
        product_url: match.productUrl,
      })),
    );

    if (matchError) throw new Error(matchError.message);
  }

  const message =
    products.length === 0
      ? `No products found matching "${query}". Try a shorter keyword or product name.`
      : matches.length > 0
        ? `Found ${matches.length} seller${matches.length === 1 ? "" : "s"} selling under your ${userPriceLabel} price.`
        : `There is no one selling under your ${userPriceLabel} price.`;

  return {
    message,
    currency,
    userPriceLabel,
    matches,
    totalSearched: products.length,
    check: mapRowToCheck(checkRow),
  };
}
