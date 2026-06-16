import "server-only";

import { fetchAliExpressProduct } from "@/lib/aliexpress/client";
import { sendEmail } from "@/lib/email/send-email";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  HandlingAddPayload,
  HandlingProduct,
  HandlingProductData,
  HandlingProductLog,
  HandlingUpdateMode,
} from "@/types/handling";

function formatPrice(price: number | null | undefined, currency: string): string {
  if (price == null) return "—";
  if (currency === "GBP") return `£${price.toFixed(2)}`;
  if (currency === "USD") return `$${price.toFixed(2)}`;
  if (currency === "EUR") return `€${price.toFixed(2)}`;
  return `${currency} ${price.toFixed(2)}`;
}

function formatRelativeTime(dateStr: string | null): string | null {
  if (!dateStr) return null;
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

function computeNextUpdateAt(mode: HandlingUpdateMode, customHours?: number): string | null {
  if (mode === "manual") return null;

  const hours = mode === "auto_24h" ? 24 : customHours;
  if (!hours || hours <= 0) return null;

  const next = new Date();
  next.setHours(next.getHours() + hours);
  return next.toISOString();
}

function getIntervalHours(mode: HandlingUpdateMode, customHours?: number): number | null {
  if (mode === "manual") return null;
  if (mode === "auto_24h") return 24;
  return customHours ?? null;
}

function mapRowToProduct(row: Record<string, unknown>): HandlingProduct {
  const currency = String(row.currency ?? "GBP");
  const price = row.price != null ? Number(row.price) : null;

  return {
    id: String(row.id),
    source: String(row.source ?? "aliexpress"),
    externalId: String(row.external_id),
    productUrl: String(row.product_url),
    title: String(row.title),
    imageUrl: row.image_url ? String(row.image_url) : null,
    price: formatPrice(price, currency),
    currency,
    stock: row.stock != null ? Number(row.stock) : null,
    orders: row.orders_count ? String(row.orders_count) : null,
    rating: row.rating != null ? Number(row.rating) : null,
    updateMode: String(row.update_mode) as HandlingUpdateMode,
    updateIntervalHours:
      row.update_interval_hours != null ? Number(row.update_interval_hours) : null,
    nextUpdateAt: row.next_update_at ? String(row.next_update_at) : null,
    lastCheckedAt: formatRelativeTime(row.last_checked_at ? String(row.last_checked_at) : null),
    status: String(row.status ?? "active"),
    addedAt: formatRelativeTime(String(row.created_at)) ?? "",
  };
}

export async function previewHandlingProduct(url: string): Promise<HandlingProductData> {
  return fetchAliExpressProduct(url);
}

export async function getHandlingProducts(userId: string): Promise<HandlingProduct[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("handling_products")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.includes("does not exist")) {
      throw new Error(
        "Handling tables missing. Run supabase/migrations/007_handling_products.sql in Supabase SQL Editor.",
      );
    }
    throw new Error(error.message);
  }

  return (data ?? []).map(mapRowToProduct);
}

export async function countHandlingProducts(userId: string): Promise<number> {
  const supabase = getSupabaseAdmin();

  const { count, error } = await supabase
    .from("handling_products")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) {
    if (error.message.includes("does not exist")) return 0;
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function addHandlingProduct(payload: HandlingAddPayload): Promise<HandlingProduct> {
  const supabase = getSupabaseAdmin();
  const intervalHours = getIntervalHours(payload.updateMode, payload.customHours);
  const nextUpdateAt = computeNextUpdateAt(payload.updateMode, payload.customHours);

  const { data, error } = await supabase
    .from("handling_products")
    .insert({
      user_id: payload.userId,
      source: payload.product.source,
      external_id: payload.product.externalId,
      product_url: payload.product.productUrl,
      title: payload.product.title,
      image_url: payload.product.imageUrl,
      price: payload.product.price,
      currency: payload.product.currency,
      stock: payload.product.stock,
      orders_count: payload.product.orders,
      rating: payload.product.rating,
      update_mode: payload.updateMode,
      update_interval_hours: intervalHours,
      next_update_at: nextUpdateAt,
      last_checked_at: new Date().toISOString(),
      status: "active",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("handling_product_logs").insert({
    product_id: data.id,
    price: payload.product.price,
    stock: payload.product.stock,
    change_summary: "Product added for handling.",
  });

  return mapRowToProduct(data);
}

export async function removeHandlingProduct(userId: string, productId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("handling_products")
    .update({ status: "removed" })
    .eq("id", productId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

async function getUserEmail(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("profiles").select("email").eq("id", userId).single();
  return data?.email ? String(data.email) : null;
}

function buildChangeSummary(
  previous: Record<string, unknown>,
  current: HandlingProductData,
): string[] {
  const changes: string[] = [];
  const previousPrice = previous.price != null ? Number(previous.price) : null;
  const previousStock = previous.stock != null ? Number(previous.stock) : null;
  const previousOrders = previous.orders_count ? String(previous.orders_count) : null;

  if (previousPrice != null && previousPrice !== current.price) {
    changes.push(
      `Price changed from ${formatPrice(previousPrice, current.currency)} to ${formatPrice(current.price, current.currency)}.`,
    );
  }

  if (previousStock != null && current.stock != null && previousStock !== current.stock) {
    changes.push(`Max qty changed from ${previousStock} to ${current.stock}.`);
  }

  if (previousOrders !== current.orders && current.orders != null) {
    changes.push(`Orders updated to ${current.orders}.`);
  }

  if (previous.title && previous.title !== current.title) {
    changes.push("Product title changed on AliExpress.");
  }

  return changes;
}

export async function checkHandlingProductUpdate(
  userId: string,
  productId: string,
  options?: { sendEmail?: boolean },
): Promise<{ product: HandlingProduct; changes: string[]; message: string }> {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: existingError } = await supabase
    .from("handling_products")
    .select("*")
    .eq("id", productId)
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (existingError || !existing) {
    throw new Error("Handling product not found.");
  }

  const latest = await fetchAliExpressProduct(String(existing.product_url));
  const changes = buildChangeSummary(existing, latest);
  const now = new Date().toISOString();
  const intervalHours =
    existing.update_interval_hours != null ? Number(existing.update_interval_hours) : null;

  let nextUpdateAt: string | null = null;
  if (existing.update_mode !== "manual" && intervalHours) {
    const next = new Date();
    next.setHours(next.getHours() + intervalHours);
    nextUpdateAt = next.toISOString();
  }

  const { data: updated, error: updateError } = await supabase
    .from("handling_products")
    .update({
      title: latest.title,
      image_url: latest.imageUrl,
      price: latest.price,
      currency: latest.currency,
      stock: latest.stock,
      orders_count: latest.orders,
      rating: latest.rating,
      last_checked_at: now,
      next_update_at: nextUpdateAt,
    })
    .eq("id", productId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  const summary =
    changes.length > 0 ? changes.join(" ") : "No price, stock, or order changes detected.";

  await supabase.from("handling_product_logs").insert({
    product_id: productId,
    price: latest.price,
    stock: latest.stock,
    change_summary: summary,
  });

  if (options?.sendEmail !== false && changes.length > 0) {
    const email = await getUserEmail(userId);
    if (email) {
      await sendEmail({
        to: email,
        subject: `Product update: ${latest.title}`,
        text: `Your handled product "${latest.title}" has updates:\n\n${changes.join("\n")}\n\nView product: ${latest.productUrl}`,
        html: `<p>Your handled product <strong>${latest.title}</strong> has updates:</p><ul>${changes.map((change) => `<li>${change}</li>`).join("")}</ul><p><a href="${latest.productUrl}">View on AliExpress</a></p>`,
      });
    }
  }

  return {
    product: mapRowToProduct(updated),
    changes,
    message: summary,
  };
}

export async function processDueHandlingUpdates(userId?: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  let query = supabase
    .from("handling_products")
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
      await checkHandlingProductUpdate(String(row.user_id), String(row.id));
      processed += 1;
    } catch {
      // continue with next product
    }
  }

  return processed;
}
