import "server-only";

import { reviseAmazefListedVariants } from "@/lib/amazef/revise-listing";
import { reviseEbayListedVariant } from "@/lib/ebay/sell-inventory";
import { sendEmail } from "@/lib/email/send-email";
import {
  addHandlingProduct,
  getHandlingProducts,
} from "@/lib/handling/service";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { HandlingProductVariant } from "@/types/handling";
import type {
  ListedProduct,
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
  if (existing) return existing.id;

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
        price: variant.price,
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

  return rows.map((row) =>
    mapProductRow(row as Record<string, unknown>, variantsByProduct.get(String(row.id)) ?? []),
  );
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
  const emailLines: string[] = [];

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
      if (nextPrice > listedPrice) {
        priceChanged = true;
      }
    }

    if ((currentAli.stock ?? 0) === 0 && (previousAli.stock ?? 0) > 0) {
      nextQuantity = 0;
      stockChanged = true;
    }

    if (!priceChanged && !stockChanged) continue;

    try {
      if (platform === "ebay" && row.offer_id) {
        await reviseEbayListedVariant(userId, draft, {
          sku: String(row.sku),
          offerId: String(row.offer_id),
          price: nextPrice,
          quantity: nextQuantity,
          label,
          ean: draft.variants.find((variant) => variant.id === aliVariantId)?.ean,
        });
      } else if (platform === "amazef" && listedProduct.listing_id) {
        await reviseAmazefListedVariants(userId, draft, String(listedProduct.listing_id), [
          { aliVariantId, price: nextPrice, quantity: nextQuantity },
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

    if (priceChanged) {
      emailLines.push(
        `${label}: AliExpress price changed from ${formatMoney(previousAli.price, currentAli.currency)} to ${formatMoney(currentAli.price, currentAli.currency)}. Your ${platform} price was updated from ${formatMoney(listedPrice, currency)} to ${formatMoney(nextPrice, currency)}.`,
      );
    }
    if (stockChanged) {
      emailLines.push(
        `${label}: AliExpress stock is now 0. Your ${platform} listing quantity was set to 0.`,
      );
    }
  }

  if (email && emailLines.length > 0) {
    const title = String(products[0]?.title ?? "Your listing");
    await sendEmail({
      to: email,
      subject: `Listing updated: ${title}`,
      text: [`We detected AliExpress changes and updated your listing:\n`, ...emailLines].join("\n"),
      html: `<p>We detected AliExpress changes and updated your listing:</p><ul>${emailLines.map((line) => `<li>${line}</li>`).join("")}</ul>`,
    });
  }
}
