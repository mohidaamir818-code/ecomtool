import "server-only";

import {
  assignUniqueVariantSkus,
  formatBaseSku,
  normalizeProductKey,
} from "@/lib/listings/internal-sku";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export interface InternalSkuAssignInput {
  userId: string;
  productUrl: string;
  variants: Array<{ id: string; label: string }>;
}

export interface InternalSkuAssignResult {
  baseSku: string;
  variantSkus: Record<string, string>;
}

async function allocateBaseSku(): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("next_listing_sku_seq");

  if (error) {
    throw new Error(`Failed to allocate internal SKU sequence: ${error.message}`);
  }

  const sequenceNumber = Number(data);
  if (!Number.isFinite(sequenceNumber) || sequenceNumber <= 0) {
    throw new Error("Failed to allocate internal SKU sequence.");
  }

  return formatBaseSku(sequenceNumber);
}

export async function ensureInternalSkus(
  input: InternalSkuAssignInput,
): Promise<InternalSkuAssignResult> {
  const productKey = normalizeProductKey(input.productUrl);
  const supabase = getSupabaseAdmin();

  const { data: existing, error: selectError } = await supabase
    .from("listing_internal_skus")
    .select("base_sku, variant_skus")
    .eq("user_id", input.userId)
    .eq("product_key", productKey)
    .maybeSingle();

  if (selectError && !selectError.message.includes("does not exist")) {
    throw new Error(selectError.message);
  }

  if (existing?.base_sku) {
    const stored = (existing.variant_skus ?? {}) as Record<string, string>;
    const merged = { ...stored };
    let changed = false;

    const missingVariants = input.variants.filter((variant) => !merged[variant.id]);
    if (missingVariants.length > 0) {
      const newSkus = assignUniqueVariantSkus(existing.base_sku, missingVariants);
      for (const [variantId, sku] of Object.entries(newSkus)) {
        merged[variantId] = sku;
        changed = true;
      }
    }

    if (changed) {
      await supabase
        .from("listing_internal_skus")
        .update({ variant_skus: merged })
        .eq("user_id", input.userId)
        .eq("product_key", productKey);
    }

    return { baseSku: existing.base_sku, variantSkus: merged };
  }

  const baseSku = await allocateBaseSku();
  const variantSkus = assignUniqueVariantSkus(baseSku, input.variants);

  const { error: insertError } = await supabase.from("listing_internal_skus").insert({
    user_id: input.userId,
    product_key: productKey,
    base_sku: baseSku,
    variant_skus: variantSkus,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  return { baseSku, variantSkus };
}
