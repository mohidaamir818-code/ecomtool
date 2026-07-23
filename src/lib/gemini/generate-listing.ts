import "server-only";

import { AiProviderError, generateAiJson, isAiAuthError } from "@/lib/gemini/client";
import { buildListingPrompt } from "@/lib/gemini/prompts";
import {
  DEFAULT_EBAY_CONDITION,
  enforceItemSpecifics,
  syncConditionInSpecifics,
  UNBRANDED,
} from "@/lib/listings/item-specifics";
import { sanitizeListingContent } from "@/lib/listings/listing-sanitize";
import type { GeneratedListing, ListingProductSource } from "@/types/listing-generator";

interface AiListingResponse {
  seoTitle?: string;
  descriptionHtml?: string;
  suggestedPrice?: number;
  currency?: string;
  itemSpecifics?: Array<{ name?: string; value?: string }>;
  categorySuggestion?: string;
  condition?: string;
}

function padTitleTo80(title: string, productTitle: string): string {
  let result = title.trim().slice(0, 80);
  if (result.length >= 80) return result;

  const fillerWords = productTitle
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !result.toLowerCase().includes(w.toLowerCase()));

  for (const word of fillerWords) {
    if (result.length >= 80) break;
    const addition = result.length > 0 ? ` ${word}` : word;
    if (result.length + addition.length <= 80) {
      result += addition;
    }
  }

  while (result.length < 80) {
    result += result.length < 77 ? " New" : " UK";
    if (result.length > 80) break;
  }

  return result.slice(0, 80);
}

function normalizeCondition(raw?: string): string {
  const value = raw?.trim() ?? "";
  if (!value) return DEFAULT_EBAY_CONDITION;
  if (/^new with tags$/i.test(value)) return "New with tags";
  if (/^new without tags$/i.test(value)) return "New without tags";
  if (/^new with defects$/i.test(value)) return "New with defects";
  if (/^used$/i.test(value) || /used/i.test(value)) return "Used";
  if (/^new$/i.test(value)) return DEFAULT_EBAY_CONDITION;
  return DEFAULT_EBAY_CONDITION;
}

export async function generateEbayListing(
  product: ListingProductSource,
  recommendedPrice?: number,
): Promise<GeneratedListing> {
  const fallbackPrice = recommendedPrice ?? Number((product.price * 2.5).toFixed(2));
  const currency = product.currency === "USD" ? "GBP" : product.currency;

  let raw: AiListingResponse | null = null;
  let lastError: Error | null = null;

  // Auth failures must not retry. Other failures get one retry (2 attempts max).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      raw = await generateAiJson<AiListingResponse>(
        buildListingPrompt(product, recommendedPrice ?? fallbackPrice),
        { maxTokens: 4096 },
      );
      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("AI request failed.");
      if (isAiAuthError(error)) break;
    }
  }

  if (!raw) {
    throw new AiProviderError(
      lastError?.message?.includes("JSON")
        ? "AI failed to generate valid listing after 2 attempts."
        : lastError?.message ?? "AI failed to generate listing after 2 attempts.",
    );
  }

  const condition = normalizeCondition(raw.condition);
  let itemSpecifics = syncConditionInSpecifics(enforceItemSpecifics(raw.itemSpecifics, product));

  const suggestedPrice =
    typeof raw.suggestedPrice === "number" && Number.isFinite(raw.suggestedPrice) && raw.suggestedPrice > 0
      ? Number(raw.suggestedPrice.toFixed(2))
      : fallbackPrice;

  const sanitized = sanitizeListingContent({
    seoTitle: raw.seoTitle ?? product.title,
    descriptionHtml: raw.descriptionHtml?.trim() || `<p>${product.description ?? product.title}</p>`,
    itemSpecifics,
  });

  itemSpecifics = sanitized.itemSpecifics;

  return {
    seoTitle: padTitleTo80(sanitized.seoTitle, product.title),
    descriptionHtml: sanitized.descriptionHtml,
    suggestedPrice,
    currency: raw.currency?.trim() || currency,
    itemSpecifics,
    categorySuggestion: raw.categorySuggestion?.trim() || "General",
    categoryId: null,
    condition,
    brand: UNBRANDED,
  };
}
