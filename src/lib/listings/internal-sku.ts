import type { ListingDraft, ListingVariantDraft } from "@/types/listing-generator";

export const INTERNAL_SKU_PREFIX = "ECT";
export const INVALID_PLACEHOLDER_SKUS = new Set(["N/A", "NA", ""]);

export function sanitizeSku(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

export function normalizeProductKey(productUrl: string): string {
  try {
    const url = new URL(productUrl.trim());
    url.hash = "";
    url.search = "";
    return url.href.replace(/\/$/, "").toLowerCase();
  } catch {
    return productUrl.trim().toLowerCase();
  }
}

export function formatBaseSku(sequenceNumber: number): string {
  return sanitizeSku(`${INTERNAL_SKU_PREFIX}-${String(sequenceNumber).padStart(6, "0")}`);
}

export function slugVariantSuffix(label: string, index: number): string {
  const parts = label.split(/\s*\/\s*/);
  const tokens: string[] = [];

  for (const part of parts) {
    const colonIdx = part.indexOf(":");
    const value = (colonIdx >= 0 ? part.slice(colonIdx + 1) : part).trim();
    if (!value) continue;
    const slug = value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (slug) tokens.push(slug);
  }

  const combined = tokens.join("-").toUpperCase().slice(0, 30);
  return combined || `V${index + 1}`;
}

export function buildVariantSku(
  baseSku: string,
  label: string,
  index: number,
  totalVariants: number,
): string {
  if (totalVariants <= 1) return sanitizeSku(baseSku);
  return sanitizeSku(`${baseSku}-${slugVariantSuffix(label, index)}`);
}

export function buildGroupSkuKey(baseSku: string): string {
  return sanitizeSku(`${baseSku}-GRP`);
}

export function assignUniqueVariantSkus(
  baseSku: string,
  variants: Array<{ id: string; label: string }>,
): Record<string, string> {
  const total = variants.length;
  const used = new Set<string>();
  const result: Record<string, string> = {};

  for (let index = 0; index < variants.length; index += 1) {
    const variant = variants[index];
    let candidate = buildVariantSku(baseSku, variant.label, index, total);

    if (used.has(candidate)) {
      candidate = sanitizeSku(`${baseSku}-V${index + 1}`);
    }

    let dedupe = 1;
    while (used.has(candidate)) {
      candidate = sanitizeSku(`${baseSku}-V${index + 1}-${dedupe}`);
      dedupe += 1;
    }

    used.add(candidate);
    result[variant.id] = candidate;
  }

  return result;
}

export function draftNeedsSkuBackfill(draft: ListingDraft): boolean {
  if (!draft.product.internalProductSku?.trim()) return true;

  const skus = draft.variants.map((variant) => variant.sku?.trim() ?? "");
  if (skus.length !== draft.variants.length) return true;
  if (skus.some((sku) => INVALID_PLACEHOLDER_SKUS.has(sku.toUpperCase()) || !sku)) return true;
  if (new Set(skus).size !== skus.length) return true;

  return false;
}

export function mergeInternalSkusIntoDraft(
  draft: ListingDraft,
  baseSku: string,
  variantSkus: Record<string, string>,
): ListingDraft {
  const isMulti = draft.variants.length > 1;

  return {
    ...draft,
    product: {
      ...draft.product,
      internalProductSku: baseSku,
    },
    variants: draft.variants.map((variant, index) => ({
      ...variant,
      sku:
        variantSkus[variant.id] ??
        (isMulti ? buildVariantSku(baseSku, variant.label, index, draft.variants.length) : baseSku),
    })),
  };
}

export function resolveVariantSkuForEbay(variant: ListingVariantDraft): string {
  const sku = sanitizeSku(variant.sku?.trim() ?? "");
  if (!sku || INVALID_PLACEHOLDER_SKUS.has(sku.toUpperCase())) {
    throw new Error(`Variant "${variant.label}" is missing an internal SKU.`);
  }
  return sku;
}

export function assertUniqueVariantSkus(variants: ListingVariantDraft[]): void {
  const skus = variants.map((variant) => resolveVariantSkuForEbay(variant));
  const unique = new Set(skus);
  if (unique.size !== skus.length) {
    throw new Error("Duplicate internal SKUs found across variants. Each variant must have a unique SKU.");
  }
}

export function resolveGroupSkuKey(draft: ListingDraft): string {
  const baseSku = draft.product.internalProductSku?.trim();
  if (!baseSku) {
    throw new Error("Internal product SKU is missing. Re-open the listing wizard to assign SKUs.");
  }
  return buildGroupSkuKey(baseSku);
}
