import "server-only";

import { reviseAmazefListedProduct } from "@/lib/amazef/revise-listed-product";
import { reviseAmazefListedVariants } from "@/lib/amazef/revise-listing";
import { reviseEbayListedProduct, reviseEbayListedVariant } from "@/lib/ebay/sell-inventory";
import { reviseEbayTradingListing } from "@/lib/ebay/seller-store";
import { sendEmail } from "@/lib/email/send-email";
import { defaultSellerPreferences, type ListingPricingPreferences } from "@/types/listing-generator";
import {
  addHandlingProduct,
  getHandlingProducts,
} from "@/lib/handling/service";
import { getSellerPreferences, sellerPreferencesToFeePrefs } from "@/lib/listings/seller-preferences";
import { calculatePricingBreakdown } from "@/lib/listings/pricing";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { HandlingProductVariant } from "@/types/handling";
import type {
  ListedProduct,
  ListedProductDetail,
  ListedProductVariant,
} from "@/types/listed-products";
import type {
  ListingDraft,
  ListingPlatform,
  ListOnEbayResult,
} from "@/types/listing-generator";

function formatMoney(amount: number, currency: string): string {
  if (currency === "GBP") return `£${amount.toFixed(2)}`;
  if (currency === "USD") return `$${amount.toFixed(2)}`;
  if (currency === "EUR") return `€${amount.toFixed(2)}`;
  return `${currency} ${amount.toFixed(2)}`;
}

function minProfitFloorForAliCost(
  aliPrice: number,
  currency: string,
  feePrefs: ListingPricingPreferences,
): number {
  const breakdown = calculatePricingBreakdown(aliPrice, { ...feePrefs, currency });
  return Number(breakdown.recommendedPrice.toFixed(2));
}

async function getUserEmail(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
  return data?.email?.trim() ?? null;
}

function mapVariantRow(row: Record<string, unknown>): ListedProductVariant {
  return {
    id: String(row.id),
    aliVariantId: String(row.ali_variant_id),
    label: String(row.label),
    sku: String(row.sku),
    offerId: row.offer_id ? String(row.offer_id) : null,
    listedPrice: Number(row.listed_price),
    listedQuantity: Number(row.listed_quantity),
    aliPrice: Number(row.ali_price),
    aliStock: row.ali_stock != null ? Number(row.ali_stock) : null,
    imageUrl: row.image_url ? String(row.image_url) : null,
  };
}

function mapProductRow(
  row: Record<string, unknown>,
  variants: ListedProductVariant[],
): ListedProduct {
  return {
    id: String(row.id),
    platform: String(row.platform) as ListingPlatform,
    aliexpressUrl: String(row.aliexpress_url),
    title: String(row.title),
    imageUrl: row.image_url ? String(row.image_url) : null,
    currency: String(row.currency ?? "GBP"),
    listingUrl: row.listing_url ? String(row.listing_url) : null,
    listingId: row.listing_id ? String(row.listing_id) : null,
    groupSku: row.group_sku ? String(row.group_sku) : null,
    variants,
    createdAt: String(row.created_at),
  };
}

export async function ensureHandlingForListedProduct(
  userId: string,
  draft: ListingDraft,
): Promise<string | null> {
  const externalId = draft.product.externalId?.trim();
  if (!externalId) return null;

  const existing = (await getHandlingProducts(userId)).find(
    (product) => product.externalId === externalId && product.status === "active",
  );
  if (existing) {
    const supabase = getSupabaseAdmin();
    const nextUpdateAt = new Date();
    nextUpdateAt.setHours(nextUpdateAt.getHours() + 24);
    await supabase
      .from("handling_products")
      .update({
        update_mode: "auto_24h",
        update_interval_hours: 24,
        next_update_at: nextUpdateAt.toISOString(),
      })
      .eq("id", existing.id)
      .eq("user_id", userId);
    return existing.id;
  }

  const handlingVariants: HandlingProductVariant[] =
    draft.product.variants?.map((variant) => ({
      id: variant.id,
      label: variant.label,
      price: variant.price,
      currency: variant.currency,
      stock: variant.stock,
      imageUrl: variant.imageUrl,
    })) ?? [];

  const product = await addHandlingProduct({
    userId,
    updateMode: "auto_24h",
    product: {
      source: "aliexpress",
      externalId,
      productUrl: draft.product.productUrl,
      title: draft.product.title,
      imageUrl: draft.product.imageUrl,
      price: draft.product.price,
      currency: draft.product.currency,
      stock: draft.product.stock,
      orders: null,
      rating: null,
      variants: handlingVariants,
    },
  });

  return product.id;
}

export async function saveListedProduct(
  userId: string,
  platform: ListingPlatform,
  draft: ListingDraft,
  listResult: ListOnEbayResult,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const handlingProductId = await ensureHandlingForListedProduct(userId, draft);
  const variantRows =
    listResult.variants ??
    draft.variants.map((variant) => {
      const source = draft.product.variants?.find((entry) => entry.id === variant.id);
      return {
        sku: variant.sku,
        offerId: listResult.offerId,
        label: variant.label,
        price: variant.price > 0 ? variant.price : draft.listing.suggestedPrice,
        quantity: variant.quantity ?? variant.stock ?? 1,
        aliVariantId: variant.id,
        aliPrice: variant.aliExpressPrice ?? source?.price ?? draft.product.price,
        aliStock: source?.stock ?? draft.product.stock,
      };
    });

  const { data: productRow, error: productError } = await supabase
    .from("listed_products")
    .insert({
      user_id: userId,
      platform,
      aliexpress_url: draft.product.productUrl,
      aliexpress_external_id: draft.product.externalId,
      handling_product_id: handlingProductId,
      title: draft.listing.seoTitle,
      image_url: draft.variants[0]?.imageUrl ?? draft.product.imageUrl,
      currency: draft.listing.currency,
      listing_url: listResult.listingUrl,
      listing_id: listResult.listingId,
      group_sku: listResult.sku,
      offer_id: listResult.offerId,
      draft_json: draft,
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (productError) {
    if (productError.message.includes("does not exist")) return;
    throw new Error(productError.message);
  }

  const variantInserts = variantRows.map((variant) => ({
    listed_product_id: productRow.id,
    ali_variant_id: variant.aliVariantId,
    label: variant.label,
    sku: variant.sku,
    offer_id: variant.offerId,
    listed_price: variant.price,
    listed_quantity: variant.quantity,
    ali_price: variant.aliPrice,
    ali_stock: variant.aliStock,
    image_url:
      draft.variants.find((entry) => entry.id === variant.aliVariantId)?.imageUrl ??
      draft.product.imageUrl,
    updated_at: new Date().toISOString(),
  }));

  const { error: variantError } = await supabase.from("listed_product_variants").insert(variantInserts);
  if (variantError && !variantError.message.includes("does not exist")) {
    throw new Error(variantError.message);
  }
}

export async function getListedProducts(userId: string): Promise<ListedProduct[]> {
  const supabase = getSupabaseAdmin();

  const { data: products, error } = await supabase
    .from("listed_products")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(error.message);
  }

  const rows = products ?? [];
  if (rows.length === 0) return [];

  const productIds = rows.map((row) => String(row.id));
  const { data: variantRows } = await supabase
    .from("listed_product_variants")
    .select("*")
    .in("listed_product_id", productIds)
    .order("label", { ascending: true });

  const variantsByProduct = new Map<string, ListedProductVariant[]>();
  for (const row of variantRows ?? []) {
    const productId = String(row.listed_product_id);
    const list = variantsByProduct.get(productId) ?? [];
    list.push(mapVariantRow(row as Record<string, unknown>));
    variantsByProduct.set(productId, list);
  }

  return rows.map((row) => {
    const fallbackPrice = Number(
      (row.draft_json as ListingDraft | null)?.listing?.suggestedPrice ?? 0,
    );
    const variants = (variantsByProduct.get(String(row.id)) ?? []).map((variant) =>
      variant.listedPrice > 0 || fallbackPrice <= 0
        ? variant
        : { ...variant, listedPrice: fallbackPrice },
    );
    return mapProductRow(row as Record<string, unknown>, variants);
  });
}

export async function getListedProductDetail(
  userId: string,
  listedProductId: string,
): Promise<ListedProductDetail | null> {
  const supabase = getSupabaseAdmin();

  const { data: row, error } = await supabase
    .from("listed_products")
    .select("*")
    .eq("id", listedProductId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    if (error.message.includes("does not exist")) return null;
    throw new Error(error.message);
  }
  if (!row) return null;

  const { data: variantRows } = await supabase
    .from("listed_product_variants")
    .select("*")
    .eq("listed_product_id", listedProductId)
    .order("label", { ascending: true });

  const variants = (variantRows ?? []).map((entry) =>
    mapVariantRow(entry as Record<string, unknown>),
  );

  return {
    ...mapProductRow(row as Record<string, unknown>, variants),
    draft: row.draft_json as ListingDraft,
  };
}

export async function updateListedProduct(
  userId: string,
  listedProductId: string,
  draft: ListingDraft,
): Promise<ListedProductDetail> {
  const supabase = getSupabaseAdmin();

  const { data: row, error } = await supabase
    .from("listed_products")
    .select("*")
    .eq("id", listedProductId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) throw new Error("Listed product not found.");

  const { data: variantRows } = await supabase
    .from("listed_product_variants")
    .select("*")
    .eq("listed_product_id", listedProductId)
    .order("label", { ascending: true });

  const existingVariants = (variantRows ?? []).map((entry) =>
    mapVariantRow(entry as Record<string, unknown>),
  );

  const platform = String(row.platform) as ListingPlatform;
  const offersBySku: Record<string, string> = {};
  for (const variant of existingVariants) {
    if (variant.offerId) {
      offersBySku[variant.sku] = variant.offerId;
    }
  }

  const amazefVariants = existingVariants.map((variant) => {
    const draftVariant = draft.variants.find((entry) => entry.id === variant.aliVariantId);
    return {
      aliVariantId: variant.aliVariantId,
      price: draftVariant?.price ?? variant.listedPrice,
      quantity: draftVariant?.quantity ?? variant.listedQuantity,
    };
  });

  if (platform === "ebay") {
    await reviseEbayListedProduct(
      userId,
      draft,
      offersBySku,
      row.group_sku ? String(row.group_sku) : null,
    );
  } else if (platform === "amazef" && row.listing_id) {
    await reviseAmazefListedProduct(userId, draft, String(row.listing_id), amazefVariants);
  } else {
    throw new Error("This listing cannot be updated on the marketplace yet.");
  }

  const primaryVariant = draft.variants[0];
  const { error: productError } = await supabase
    .from("listed_products")
    .update({
      title: draft.listing.seoTitle,
      image_url: primaryVariant?.imageUrl ?? draft.product.imageUrl,
      draft_json: draft,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listedProductId)
    .eq("user_id", userId);

  if (productError) throw new Error(productError.message);

  for (const variant of existingVariants) {
    const draftVariant = draft.variants.find((entry) => entry.id === variant.aliVariantId);
    if (!draftVariant) continue;

    await supabase
      .from("listed_product_variants")
      .update({
        label: draftVariant.label,
        listed_price: draftVariant.price,
        listed_quantity: draftVariant.quantity,
        image_url: draftVariant.imageUrl || variant.imageUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", variant.id);
  }

  const detail = await getListedProductDetail(userId, listedProductId);
  if (!detail) throw new Error("Failed to load updated listing.");
  return detail;
}

export async function removeListedProduct(userId: string, listedProductId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("listed_products")
    .update({ status: "removed", updated_at: new Date().toISOString() })
    .eq("id", listedProductId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface SyncEmailUpdate {
  title: string;
  imageUrl: string | null;
  platformLabel: string;
  variantLabel: string;
  lines: string[];
}

function buildSyncUpdateEmailHtml(updates: SyncEmailUpdate[]): string {
  const cards = updates
    .map((update) => {
      const imageBlock = update.imageUrl
        ? `<img src="${escapeHtml(update.imageUrl)}" alt="" width="100" height="100" style="display:block;border-radius:8px;object-fit:cover;" />`
        : "";
      return `<div style="margin-bottom:18px;padding:16px;border:1px solid #E5E7EB;border-radius:10px;background:#FAFAFA;">
        <table cellpadding="0" cellspacing="0"><tr>
          ${imageBlock ? `<td valign="top" style="padding-right:12px;">${imageBlock}</td>` : ""}
          <td valign="top">
            <p style="margin:0;font-size:16px;font-weight:700;color:#111827;">${escapeHtml(update.title)}</p>
            <p style="margin:6px 0 0;font-size:12px;color:#6B7280;">${escapeHtml(update.platformLabel)} · Variant: <strong>${escapeHtml(update.variantLabel)}</strong></p>
          </td>
        </tr></table>
        <ul style="margin:12px 0 0;padding-left:18px;color:#374151;font-size:14px;line-height:1.5;">
          ${update.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
        </ul>
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:20px;background:#2563EB;color:#ffffff;font-size:16px;font-weight:700;">
        Marketplace auto-sync update
      </td>
    </tr>
    <tr>
      <td style="padding:20px;">
        <p style="margin:0 0 16px;font-size:14px;color:#374151;">We checked your linked products and updated your marketplace listing where AliExpress changed.</p>
        ${cards}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function syncListedProductsForAliVariants(
  userId: string,
  previousVariants: HandlingProductVariant[],
  currentVariants: HandlingProductVariant[],
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const previousById = new Map(previousVariants.map((variant) => [variant.id, variant]));
  const changedVariants = currentVariants.filter((current) => {
    const previous = previousById.get(current.id);
    if (!previous) return false;
    const priceChanged = previous.price !== current.price;
    const stockChanged = (previous.stock ?? 0) !== (current.stock ?? 0);
    return priceChanged || stockChanged;
  });

  if (changedVariants.length === 0) return;

  const aliIds = new Set(changedVariants.map((variant) => variant.id));
  const { data: products } = await supabase
    .from("listed_products")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active");

  if (!products?.length) return;

  const productIds = products.map((row) => String(row.id));
  const { data: listedVariants } = await supabase
    .from("listed_product_variants")
    .select("*")
    .in("listed_product_id", productIds)
    .in("ali_variant_id", [...aliIds]);

  if (!listedVariants?.length) return;

  const productsById = new Map(products.map((row) => [String(row.id), row]));

  const email = await getUserEmail(userId);
  const emailUpdates: SyncEmailUpdate[] = [];

  for (const row of listedVariants) {
    const listedProduct = productsById.get(String(row.listed_product_id));
    if (!listedProduct) continue;
    const aliVariantId = String(row.ali_variant_id);
    const currentAli = currentVariants.find((variant) => variant.id === aliVariantId);
    const previousAli = previousById.get(aliVariantId);
    if (!currentAli || !previousAli) continue;

    const listedPrice = Number(row.listed_price);
    const listedQuantity = Number(row.listed_quantity);
    const label = String(row.label);
    const platform = String(listedProduct.platform) as ListingPlatform;
    const currency = String(listedProduct.currency ?? "GBP");
    const draft = listedProduct.draft_json as ListingDraft;
    let nextPrice = listedPrice;
    let nextQuantity = listedQuantity;
    let priceChanged = false;
    let stockChanged = false;

    if (previousAli.price < currentAli.price) {
      const delta = currentAli.price - previousAli.price;
      nextPrice = Number((listedPrice + delta).toFixed(2));
      if (nextPrice !== listedPrice) {
        priceChanged = true;
      }
    }

    if ((currentAli.stock ?? 0) === 0 && (previousAli.stock ?? 0) > 0) {
      nextQuantity = 0;
      stockChanged = true;
    }

    if (!priceChanged && !stockChanged) continue;

    const tradingImport = draft.ebayTradingImport;
    const tradingVariant = tradingImport?.variants.find((variant) => variant.label === label);

    try {
      if (platform === "ebay" && tradingImport?.listingId) {
        await reviseEbayTradingListing(userId, tradingImport.listingId, {
          price: priceChanged ? nextPrice : undefined,
          quantity: stockChanged ? nextQuantity : undefined,
          label,
          sku: String(row.sku),
          variationSpecifics: tradingVariant?.variationSpecifics,
        });
      } else if (platform === "ebay" && row.offer_id && draft.ebayPolicies && draft.listing.categoryId) {
        await reviseEbayListedVariant(userId, draft, {
          sku: String(row.sku),
          offerId: String(row.offer_id),
          price: priceChanged ? nextPrice : listedPrice,
          quantity: stockChanged ? nextQuantity : listedQuantity,
          label,
          ean: draft.variants.find((variant) => variant.id === aliVariantId)?.ean,
        });
      } else if (platform === "amazef" && listedProduct.listing_id) {
        await reviseAmazefListedVariants(userId, draft, String(listedProduct.listing_id), [
          {
            aliVariantId,
            price: priceChanged ? nextPrice : listedPrice,
            quantity: stockChanged ? nextQuantity : listedQuantity,
          },
        ]);
      }
    } catch {
      continue;
    }

    await supabase
      .from("listed_product_variants")
      .update({
        listed_price: nextPrice,
        listed_quantity: nextQuantity,
        ali_price: currentAli.price,
        ali_stock: currentAli.stock,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    const platformLabel = platform === "amazef" ? "Amazef" : "eBay";
    const updateLines: string[] = [];

    if (priceChanged) {
      updateLines.push(
        `AliExpress price: ${formatMoney(previousAli.price, currentAli.currency)} → ${formatMoney(currentAli.price, currentAli.currency)}. Your ${platformLabel} price: ${formatMoney(listedPrice, currency)} → ${formatMoney(nextPrice, currency)}.`,
      );
    }
    if (stockChanged) {
      updateLines.push(
        `AliExpress stock reached 0. Your ${platformLabel} quantity for this variant was set to 0.`,
      );
    }

    if (updateLines.length > 0) {
      emailUpdates.push({
        title: String(listedProduct.title ?? "Your listing"),
        imageUrl: listedProduct.image_url
          ? String(listedProduct.image_url)
          : row.image_url
            ? String(row.image_url)
            : null,
        platformLabel,
        variantLabel: label,
        lines: updateLines,
      });
    }
  }

  if (email && emailUpdates.length > 0) {
    const primaryTitle = emailUpdates[0]?.title ?? "Your listing";
    await sendEmail({
      to: email,
      subject: `Auto-sync update: ${primaryTitle}`,
      text: emailUpdates
        .map(
          (update) =>
            `${update.title} (${update.platformLabel}, ${update.variantLabel})\n${update.lines.join("\n")}`,
        )
        .join("\n\n"),
      html: buildSyncUpdateEmailHtml(emailUpdates),
    });
  }
}
