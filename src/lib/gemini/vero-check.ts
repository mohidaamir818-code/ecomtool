import "server-only";

import { generateAiJson } from "@/lib/gemini/client";
import { buildVeroCheckPrompt } from "@/lib/gemini/prompts";
import type { ListingProductSource, VeroCheckResult } from "@/types/listing-generator";

interface AiVeroResponse {
  safe?: boolean;
  isCounterfeitOrBranded?: boolean;
  isBannedCategory?: boolean;
  hasRestrictedWords?: boolean;
  warnings?: string[];
  summary?: string;
}

const BRAND_KEYWORDS = [
  "nike",
  "apple",
  "iphone",
  "samsung",
  "adidas",
  "gucci",
  "louis vuitton",
  "disney",
  "sony",
  "playstation",
  "xbox",
  "rolex",
];

const RESTRICTED_WORDS = ["replica", "1:1", "fake", "counterfeit", "oem copy", "knockoff"];

function localHeuristicCheck(product: ListingProductSource, title?: string): VeroCheckResult | null {
  const haystack = `${title ?? ""} ${product.title} ${product.description ?? ""}`.toLowerCase();

  const brandHit = BRAND_KEYWORDS.find((keyword) => haystack.includes(keyword));
  const restrictedHit = RESTRICTED_WORDS.find((word) => haystack.includes(word));

  if (!brandHit && !restrictedHit) return null;

  const warnings: string[] = [];
  if (brandHit) warnings.push(`Possible branded item detected: ${brandHit}`);
  if (restrictedHit) warnings.push(`Restricted word detected: ${restrictedHit}`);

  return {
    safe: false,
    isCounterfeitOrBranded: Boolean(brandHit),
    isBannedCategory: false,
    hasRestrictedWords: Boolean(restrictedHit),
    warnings,
    summary: "Do not list — account may get banned. Product appears high-risk for VeRO or policy violations.",
  };
}

export async function checkVeroSafety(
  product: ListingProductSource,
  title?: string,
): Promise<VeroCheckResult> {
  const local = localHeuristicCheck(product, title);
  if (local) return local;

  const raw = await generateAiJson<AiVeroResponse>(buildVeroCheckPrompt(product, title));

  const warnings = (raw.warnings ?? []).map((entry) => String(entry).trim()).filter(Boolean);
  const isCounterfeitOrBranded = Boolean(raw.isCounterfeitOrBranded);
  const isBannedCategory = Boolean(raw.isBannedCategory);
  const hasRestrictedWords = Boolean(raw.hasRestrictedWords);

  const safe =
    raw.safe === true &&
    !isCounterfeitOrBranded &&
    !isBannedCategory &&
    !hasRestrictedWords;

  return {
    safe,
    isCounterfeitOrBranded,
    isBannedCategory,
    hasRestrictedWords,
    warnings,
    summary: safe
      ? raw.summary?.trim() || "Product appears safe to list on eBay UK."
      : raw.summary?.trim() ||
        "Do not list — account may get banned. This product may violate eBay VeRO or category policies.",
  };
}
