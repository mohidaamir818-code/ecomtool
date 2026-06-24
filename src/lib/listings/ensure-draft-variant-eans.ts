import "server-only";

import { generateAiJson } from "@/lib/gemini/client";
import type { ListingDraft, ListingVariantDraft } from "@/types/listing-generator";

export function isValidGtin(value: string | undefined | null): boolean {
  if (!value) return false;
  return /^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(value.trim());
}

function computeEan13CheckDigit(digits12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(digits12[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return `${digits12}${check}`;
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function eanFromSeed(seed: string): string {
  const hash = hashSeed(seed);
  const base = String(hash).padStart(12, "0").slice(-12);
  return computeEan13CheckDigit(base);
}

function uniqueEanFromSeed(seed: string, used: Set<string>): string {
  let attempt = 0;
  while (attempt < 20) {
    const candidate = eanFromSeed(`${seed}:${attempt}`);
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    attempt++;
  }
  const fallback = eanFromSeed(`${seed}:${Date.now()}`);
  used.add(fallback);
  return fallback;
}

async function requestAiEans(
  productTitle: string,
  variants: ListingVariantDraft[],
): Promise<string[]> {
  const labels = variants.map((variant, index) => variant.label?.trim() || `Variant ${index + 1}`);
  const prompt = `You are helping complete eBay product identifiers for an unbranded dropshipping listing.

Product: ${productTitle}

Variants (${labels.length}):
${labels.map((label, index) => `${index + 1}. ${label}`).join("\n")}

Return JSON only:
{
  "eans": ["<13-digit EAN>", ...]
}

Rules:
- Return exactly ${labels.length} unique values in the same order as the variants.
- Each value must be a valid 13-digit EAN/GTIN (digits only).
- Do not reuse the same EAN across variants.`;

  const response = await generateAiJson<{ eans?: string[] }>(prompt, { maxTokens: 512 });
  if (!Array.isArray(response.eans)) return [];

  return response.eans.map((value) => String(value).replace(/\D/g, "")).filter(isValidGtin);
}

export async function ensureDraftVariantEans(draft: ListingDraft): Promise<ListingDraft> {
  const variants = draft.variants.length > 0 ? draft.variants : [];
  if (variants.every((variant) => isValidGtin(variant.ean))) {
    return draft;
  }

  const missing = variants.filter((variant) => !isValidGtin(variant.ean));
  const used = new Set(
    variants.map((variant) => variant.ean?.trim()).filter((value): value is string => isValidGtin(value)),
  );

  let aiEans: string[] = [];
  try {
    aiEans = await requestAiEans(draft.product.title, missing);
  } catch {
    aiEans = [];
  }

  let aiIndex = 0;
  const updatedVariants = variants.map((variant) => {
    if (isValidGtin(variant.ean)) return variant;

    const aiValue = aiEans[aiIndex];
    aiIndex += 1;
    if (isValidGtin(aiValue) && !used.has(aiValue.trim())) {
      used.add(aiValue.trim());
      return { ...variant, ean: aiValue.trim() };
    }

    const seed = [
      draft.product.productUrl,
      draft.product.internalProductSku,
      variant.sku,
      variant.label,
      variant.id,
    ]
      .filter(Boolean)
      .join("|");

    return { ...variant, ean: uniqueEanFromSeed(seed, used) };
  });

  return { ...draft, variants: updatedVariants };
}
