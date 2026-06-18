import "server-only";

import { searchAmazefProducts } from "@/lib/amazef/client";
import { searchEbayListings } from "@/lib/ebay/browse";
import { getEbayCompetitorWatchSearchQuery, ebayListingMatchesProductQuery } from "@/lib/ebay/query";
import { sendEmail } from "@/lib/email/send-email";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  CompetitorCheck,
  CompetitorMatch,
  CompetitorMatchVariant,
  CompetitorPlatform,
  CompetitorUpdateMode,
  CompetitorWatch,
  CompetitorWatchAddPayload,
} from "@/types/competitor";
import type { EbayListing } from "@/types/ebay";

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

function computeNextUpdateAt(mode: CompetitorUpdateMode, customHours?: number): string | null {
  if (mode === "manual") return null;

  const hours = mode === "auto_24h" ? 24 : customHours;
  if (!hours || hours <= 0) return null;

  const next = new Date();
  next.setHours(next.getHours() + hours);
  return next.toISOString();
}

function getIntervalHours(mode: CompetitorUpdateMode, customHours?: number): number | null {
  if (mode === "manual") return null;
  if (mode === "auto_24h") return 24;
  return customHours ?? null;
}

async function getUserEmail(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("profiles").select("email").eq("id", userId).single();
  return data?.email ? String(data.email) : null;
}

function marketplaceLabel(platform: CompetitorPlatform): string {
  return platform === "ebay" ? "eBay" : "Amazef";
}

function buildWatchMessage(
  productQuery: string,
  userPriceLabel: string,
  matchesFound: number,
  totalSearched: number,
  platform: CompetitorPlatform = "amazef",
): string {
  const marketplace = marketplaceLabel(platform);

  if (totalSearched === 0) {
    return `No listings found on ${marketplace} matching "${productQuery}". Try a shorter keyword or product name.`;
  }

  if (matchesFound > 0) {
    return `${matchesFound} listing${matchesFound === 1 ? "" : "s"} below your "${productQuery}" price on ${marketplace} (${userPriceLabel}).`;
  }

  return `No sellers on ${marketplace} found below your ${userPriceLabel} price for "${productQuery}".`;
}

function getEbayListingGroupKey(listing: EbayListing): string {
  const titleKey = listing.title.trim().toLowerCase();
  const sellerKey = listing.sellerName.trim().toLowerCase();
  return `${sellerKey}::${titleKey}`;
}

function buildEbayMatchFromGroup(group: EbayListing[], userPrice: number): CompetitorMatch {
  const sorted = [...group].sort((a, b) => a.totalPrice - b.totalPrice);
  const primary = sorted[0];
  const currency = primary.currency;
  const minPrice = sorted[0].totalPrice;
  const maxPrice = sorted[sorted.length - 1].totalPrice;
  const hasMultipleVariants = sorted.length > 1;

  const variants: CompetitorMatchVariant[] = sorted.map((listing, index) => ({
    id: listing.id,
    label: listing.variantLabel ?? `Variant ${index + 1}`,
    price: listing.totalPrice,
    priceLabel: listing.totalPriceLabel,
    priceDifference: userPrice - listing.totalPrice,
    priceDifferenceLabel: formatPrice(userPrice - listing.totalPrice, currency),
    productUrl: listing.listingUrl,
  }));

  const priceLabel =
    hasMultipleVariants && minPrice !== maxPrice
      ? `${formatPrice(minPrice, currency)} to ${formatPrice(maxPrice, currency)}`
      : primary.totalPriceLabel;

  return {
    id: hasMultipleVariants ? getEbayListingGroupKey(primary) : primary.id,
    productName: primary.title,
    sellerName: primary.sellerName,
    price: minPrice,
    priceLabel,
    priceMax: hasMultipleVariants && minPrice !== maxPrice ? maxPrice : undefined,
    currency,
    priceDifference: userPrice - minPrice,
    priceDifferenceLabel: formatPrice(userPrice - minPrice, currency),
    imageUrl: primary.imageUrl,
    productUrl: primary.listingUrl,
    variants: hasMultipleVariants ? variants : undefined,
  };
}

function groupEbayCheaperMatches(listings: EbayListing[], userPrice: number): CompetitorMatch[] {
  const groups = new Map<string, EbayListing[]>();

  for (const listing of listings) {
    const key = getEbayListingGroupKey(listing);
    const existing = groups.get(key) ?? [];
    existing.push(listing);
    groups.set(key, existing);
  }

  return [...groups.values()]
    .map((group) => buildEbayMatchFromGroup(group, userPrice))
    .sort((a, b) => a.price - b.price);
}

function parseVariantsJson(value: unknown, userPrice: number, currency: string): CompetitorMatchVariant[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;

  const variants = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const price = Number(row.price);
      if (!Number.isFinite(price)) return null;

      return {
        id: String(row.id ?? crypto.randomUUID()),
        label: String(row.label ?? "Variant"),
        price,
        priceLabel: row.priceLabel ? String(row.priceLabel) : formatPrice(price, currency),
        priceDifference: userPrice - price,
        priceDifferenceLabel: formatPrice(userPrice - price, currency),
        productUrl: row.productUrl ? String(row.productUrl) : null,
      } satisfies CompetitorMatchVariant;
    })
    .filter((variant): variant is CompetitorMatchVariant => variant !== null);

  return variants.length > 0 ? variants : undefined;
}

export async function searchCheaperCompetitors(
  productQuery: string,
  userPrice: number,
): Promise<{
  matches: CompetitorMatch[];
  totalSearched: number;
  currency: string;
  userPriceLabel: string;
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
      sellerName: product.sellerName,
      price: product.price,
      priceLabel: formatPrice(product.price, product.currency),
      currency: product.currency,
      priceDifference,
      priceDifferenceLabel: formatPrice(priceDifference, product.currency),
      imageUrl: product.imageUrl,
      productUrl: product.productUrl,
    };
  });

  return {
    matches,
    totalSearched: products.length,
    currency,
    userPriceLabel,
  };
}

export async function searchCheaperEbayCompetitors(
  productQuery: string,
  userPrice: number,
): Promise<{
  matches: CompetitorMatch[];
  totalSearched: number;
  currency: string;
  userPriceLabel: string;
}> {
  const query = productQuery.trim();
  const candidateQuery = getEbayCompetitorWatchSearchQuery(query);

  const result = await searchEbayListings({
    query: candidateQuery,
    limit: 25,
    offset: 0,
    sort: "asc",
    enrichDetails: false,
  });

  const bestRelevantListings = result.listings.filter((listing) =>
    ebayListingMatchesProductQuery(listing.title, query),
  );

  const currency = bestRelevantListings[0]?.currency ?? "GBP";
  const userPriceLabel = formatPrice(userPrice, currency);

  const cheaperListings = bestRelevantListings
    .filter((listing) => listing.totalPrice > 0 && listing.totalPrice < userPrice)
    .sort((a, b) => a.totalPrice - b.totalPrice);

  const matches = groupEbayCheaperMatches(cheaperListings, userPrice);

  return {
    matches,
    totalSearched: bestRelevantListings.length,
    currency,
    userPriceLabel,
  };
}

export async function searchCheaperCompetitorsByPlatform(
  platform: CompetitorPlatform,
  productQuery: string,
  userPrice: number,
): Promise<{
  matches: CompetitorMatch[];
  totalSearched: number;
  currency: string;
  userPriceLabel: string;
}> {
  if (platform === "ebay") {
    return searchCheaperEbayCompetitors(productQuery, userPrice);
  }

  return searchCheaperCompetitors(productQuery, userPrice);
}

function mapRowToWatch(row: Record<string, unknown>): CompetitorWatch {
  const currency = String(row.currency ?? "GBP");
  const userPrice = Number(row.user_price);
  const matchesFound = Number(row.matches_found ?? 0);

  return {
    id: String(row.id),
    platform: (row.platform === "ebay" ? "ebay" : "amazef") as CompetitorPlatform,
    productQuery: String(row.product_query),
    userPrice,
    userPriceLabel: formatPrice(userPrice, currency),
    currency,
    matchesFound,
    productsSearched: Number(row.products_searched ?? 0),
    updateMode: String(row.update_mode) as CompetitorUpdateMode,
    updateIntervalHours:
      row.update_interval_hours != null ? Number(row.update_interval_hours) : null,
    nextUpdateAt: row.next_update_at ? String(row.next_update_at) : null,
    lastCheckedAt: row.last_checked_at
      ? formatRelativeTime(String(row.last_checked_at))
      : null,
    addedAt: formatRelativeTime(String(row.created_at)) ?? "",
    hasAlert: matchesFound > 0,
  };
}

async function replaceWatchMatches(watchId: string, matches: CompetitorMatch[]): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error: deleteError } = await supabase
    .from("competitor_watch_matches")
    .delete()
    .eq("watch_id", watchId);

  if (deleteError) throw new Error(deleteError.message);

  if (matches.length === 0) return;

  const { error: insertError } = await supabase.from("competitor_watch_matches").insert(
    matches.map((match) => ({
      watch_id: watchId,
      external_product_id: match.id,
      product_name: match.productName,
      seller_name: match.sellerName,
      competitor_price: match.price,
      currency: match.currency,
      image_url: match.imageUrl,
      product_url: match.productUrl,
      variants_json: match.variants?.length ? match.variants : null,
    })),
  );

  if (insertError) throw new Error(insertError.message);
}

export async function getCompetitorWatches(userId: string): Promise<CompetitorWatch[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("competitor_watches")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("matches_found", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.includes("does not exist")) {
      throw new Error(
        "Competitor watch tables missing. Run supabase/migrations/010_competitor_watches.sql in Supabase SQL Editor.",
      );
    }
    throw new Error(error.message);
  }

  return (data ?? [])
    .map(mapRowToWatch)
    .sort((a, b) => {
      if (a.hasAlert !== b.hasAlert) return a.hasAlert ? -1 : 1;
      return 0;
    });
}

export async function getCompetitorWatchDetails(
  userId: string,
  watchId: string,
): Promise<{
  watch: CompetitorWatch;
  matches: CompetitorMatch[];
  message: string;
  userPriceLabel: string;
  totalSearched: number;
}> {
  const supabase = getSupabaseAdmin();

  const { data: watchRow, error: watchError } = await supabase
    .from("competitor_watches")
    .select("*")
    .eq("id", watchId)
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (watchError) {
    throw new Error(
      watchError.message.includes("does not exist")
        ? "Competitor watch tables missing. Run supabase/migrations/010_competitor_watches.sql in Supabase SQL Editor."
        : "Competitor watch not found.",
    );
  }

  const watch = mapRowToWatch(watchRow);
  const userPrice = Number(watchRow.user_price);

  const { data: matchRows, error: matchError } = await supabase
    .from("competitor_watch_matches")
    .select("*")
    .eq("watch_id", watchId)
    .order("competitor_price", { ascending: true });

  if (matchError && !matchError.message.includes("does not exist")) {
    throw new Error(matchError.message);
  }

  const matches = (matchRows ?? []).map((row) => mapRowToMatch(row, userPrice));
  const totalSearched = Number(watchRow.products_searched ?? 0);

  return {
    watch,
    matches,
    message: buildWatchMessage(
      watch.productQuery,
      watch.userPriceLabel,
      watch.matchesFound,
      totalSearched,
      watch.platform,
    ),
    userPriceLabel: watch.userPriceLabel,
    totalSearched,
  };
}

export async function addCompetitorWatch(
  payload: CompetitorWatchAddPayload,
): Promise<{ watch: CompetitorWatch; message: string; matches: CompetitorMatch[] }> {
  const supabase = getSupabaseAdmin();
  const query = payload.productQuery.trim();
  const platform = payload.platform === "ebay" ? "ebay" : "amazef";
  const intervalHours = getIntervalHours(payload.updateMode, payload.customHours);
  const nextUpdateAt = computeNextUpdateAt(payload.updateMode, payload.customHours);
  const search = await searchCheaperCompetitorsByPlatform(platform, query, payload.userPrice);
  const now = new Date().toISOString();

  const { data: watchRow, error: watchError } = await supabase
    .from("competitor_watches")
    .insert({
      user_id: payload.userId,
      platform,
      product_query: query,
      user_price: payload.userPrice,
      currency: search.currency,
      update_mode: payload.updateMode,
      update_interval_hours: intervalHours,
      next_update_at: nextUpdateAt,
      last_checked_at: now,
      matches_found: search.matches.length,
      products_searched: search.totalSearched,
      status: "active",
    })
    .select()
    .single();

  if (watchError) throw new Error(watchError.message);

  await replaceWatchMatches(String(watchRow.id), search.matches);

  const message = buildWatchMessage(
    query,
    search.userPriceLabel,
    search.matches.length,
    search.totalSearched,
    platform,
  );

  await supabase.from("competitor_watch_logs").insert({
    watch_id: watchRow.id,
    matches_found: search.matches.length,
    change_summary: message,
  });

  const email = await getUserEmail(payload.userId);
  if (email) {
    await sendCompetitorWatchEmail(
      email,
      query,
      message,
      search.matches,
      search.userPriceLabel,
      platform,
    );
  }

  return {
    watch: mapRowToWatch(watchRow),
    message,
    matches: search.matches,
  };
}

export async function removeCompetitorWatch(userId: string, watchId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("competitor_watches")
    .update({ status: "removed" })
    .eq("id", watchId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

async function sendCompetitorWatchEmail(
  email: string,
  productQuery: string,
  message: string,
  matches: CompetitorMatch[],
  userPriceLabel: string,
  platform: CompetitorPlatform = "amazef",
): Promise<void> {
  const marketplace = marketplaceLabel(platform);
  const matchLines =
    matches.length > 0
      ? matches
          .slice(0, 10)
          .map((match) => {
            const seller = match.sellerName ? ` (${match.sellerName})` : "";
            return `• ${match.productName}${seller} — ${match.priceLabel} (${match.priceDifferenceLabel} below you)`;
          })
          .join("\n")
      : "No competitors below your price right now.";

  await sendEmail({
    to: email,
    subject: `Competitor update (${marketplace}): ${productQuery}`,
    text: `${message}\n\nYour price: ${userPriceLabel}\n\n${matchLines}`,
    html: `<p>${message}</p><p><strong>Your price:</strong> ${userPriceLabel}</p>${
      matches.length > 0
        ? `<ul>${matches
            .slice(0, 10)
            .map((match) => {
              const seller = match.sellerName
                ? ` <span style="color:#6B7280">(${match.sellerName})</span>`
                : "";
              return `<li><strong>${match.productName}</strong>${seller} — ${match.priceLabel} (${match.priceDifferenceLabel} below you)</li>`;
            })
            .join("")}</ul>`
        : "<p>No competitors below your price right now.</p>"
    }`,
  });
}

export async function checkCompetitorWatchUpdate(
  userId: string,
  watchId: string,
  options?: { sendEmail?: boolean },
): Promise<{ watch: CompetitorWatch; message: string; matches: CompetitorMatch[] }> {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: existingError } = await supabase
    .from("competitor_watches")
    .select("*")
    .eq("id", watchId)
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (existingError || !existing) {
    throw new Error("Competitor watch not found.");
  }

  const query = String(existing.product_query);
  const userPrice = Number(existing.user_price);
  const platform = (existing.platform === "ebay" ? "ebay" : "amazef") as CompetitorPlatform;
  const search = await searchCheaperCompetitorsByPlatform(platform, query, userPrice);
  const now = new Date().toISOString();
  const intervalHours =
    existing.update_interval_hours != null ? Number(existing.update_interval_hours) : null;

  let nextUpdateAt: string | null = null;
  if (existing.update_mode !== "manual" && intervalHours) {
    const next = new Date();
    next.setHours(next.getHours() + intervalHours);
    nextUpdateAt = next.toISOString();
  }

  const message = buildWatchMessage(
    query,
    search.userPriceLabel,
    search.matches.length,
    search.totalSearched,
    platform,
  );

  const { data: updated, error: updateError } = await supabase
    .from("competitor_watches")
    .update({
      currency: search.currency,
      matches_found: search.matches.length,
      products_searched: search.totalSearched,
      last_checked_at: now,
      next_update_at: nextUpdateAt,
    })
    .eq("id", watchId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  await replaceWatchMatches(watchId, search.matches);

  await supabase.from("competitor_watch_logs").insert({
    watch_id: watchId,
    matches_found: search.matches.length,
    change_summary: message,
  });

  if (options?.sendEmail !== false) {
    const email = await getUserEmail(userId);
    if (email) {
      await sendCompetitorWatchEmail(
        email,
        query,
        message,
        search.matches,
        search.userPriceLabel,
        platform,
      );
    }
  }

  return {
    watch: mapRowToWatch(updated),
    message,
    matches: search.matches,
  };
}

export async function upgradeCompetitorWatchPrice(
  userId: string,
  watchId: string,
  newPrice: number,
): Promise<{ watch: CompetitorWatch; message: string; matches: CompetitorMatch[] }> {
  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    throw new Error("Enter a valid selling price greater than 0.");
  }

  const supabase = getSupabaseAdmin();

  const { data: existing, error: existingError } = await supabase
    .from("competitor_watches")
    .select("id")
    .eq("id", watchId)
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (existingError || !existing) {
    throw new Error("Competitor watch not found.");
  }

  const { error: updateError } = await supabase
    .from("competitor_watches")
    .update({ user_price: newPrice })
    .eq("id", watchId)
    .eq("user_id", userId);

  if (updateError) throw new Error(updateError.message);

  return checkCompetitorWatchUpdate(userId, watchId, { sendEmail: false });
}

export async function processDueCompetitorWatchUpdates(userId?: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  let query = supabase
    .from("competitor_watches")
    .select("id, user_id")
    .eq("status", "active")
    .neq("update_mode", "manual")
    .lte("next_update_at", now);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.limit(20);

  if (error) {
    if (error.message.includes("does not exist")) return 0;
    throw new Error(error.message);
  }

  let processed = 0;

  for (const row of data ?? []) {
    try {
      await checkCompetitorWatchUpdate(String(row.user_id), String(row.id));
      processed += 1;
    } catch {
      // continue with next watch
    }
  }

  return processed;
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
  const variants = parseVariantsJson(row.variants_json, userPrice, currency);
  const maxVariantPrice =
    variants && variants.length > 1
      ? Math.max(...variants.map((variant) => variant.price))
      : undefined;

  return {
    id: externalId,
    productName: String(row.product_name),
    sellerName: row.seller_name ? String(row.seller_name) : null,
    price,
    priceLabel:
      variants && variants.length > 1 && maxVariantPrice != null && maxVariantPrice !== price
        ? `${formatPrice(price, currency)} to ${formatPrice(maxVariantPrice, currency)}`
        : formatPrice(price, currency),
    priceMax:
      maxVariantPrice != null && maxVariantPrice !== price ? maxVariantPrice : undefined,
    currency,
    priceDifference,
    priceDifferenceLabel: formatPrice(priceDifference, currency),
    imageUrl: row.image_url ? String(row.image_url) : null,
    productUrl: row.product_url
      ? String(row.product_url)
      : `https://amazef.com/products/${externalId}`,
    variants,
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
  const search = await searchCheaperCompetitors(query, userPrice);
  const supabase = getSupabaseAdmin();

  const { data: checkRow, error: checkError } = await supabase
    .from("competitor_checks")
    .insert({
      user_id: userId,
      product_query: query,
      user_price: userPrice,
      currency: search.currency,
      matches_found: search.matches.length,
      products_searched: search.totalSearched,
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

  if (search.matches.length > 0) {
    const { error: matchError } = await supabase.from("competitor_matches").insert(
      search.matches.map((match) => ({
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

  const message = buildWatchMessage(
    query,
    search.userPriceLabel,
    search.matches.length,
    search.totalSearched,
    "amazef",
  );

  return {
    message,
    currency: search.currency,
    userPriceLabel: search.userPriceLabel,
    matches: search.matches,
    totalSearched: search.totalSearched,
    check: mapRowToCheck(checkRow),
  };
}
