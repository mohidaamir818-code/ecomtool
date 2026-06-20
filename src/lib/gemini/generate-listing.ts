import "server-only";

import { generateAiJson } from "@/lib/gemini/client";
import { buildListingPrompt } from "@/lib/gemini/prompts";
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

const UNBRANDED = "Unbranded";

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

function normalizeItemSpecifics(
  raw: Array<{ name?: string; value?: string }> | undefined,
  condition: string,
): GeneratedListing["itemSpecifics"] {
  const specifics = (raw ?? [])
    .map((entry) => ({
      name: String(entry.name ?? "").trim(),
      value: String(entry.value ?? "").trim(),
    }))
    .filter((entry) => entry.name && entry.value)
    .filter((entry) => entry.name.toLowerCase() !== "brand" && entry.name.toLowerCase() !== "mpn");

  specifics.unshift({ name: "MPN", value: "Does Not Apply" });
  specifics.unshift({ name: "Brand", value: UNBRANDED });

  if (!specifics.some((entry) => entry.name.toLowerCase() === "condition")) {
    specifics.unshift({ name: "Condition", value: condition });
  }

  return specifics;
}

export async function generateEbayListing(
  product: ListingProductSource,
  recommendedPrice?: number,
): Promise<GeneratedListing> {
  const fallbackPrice = recommendedPrice ?? Number((product.price * 2.5).toFixed(2));
  const currency = product.currency === "USD" ? "GBP" : product.currency;

  const raw = await generateAiJson<AiListingResponse>(
    buildListingPrompt(product, recommendedPrice ?? fallbackPrice),
  );

  const condition = raw.condition?.trim() || "New";
  const itemSpecifics = normalizeItemSpecifics(raw.itemSpecifics, condition);

  const suggestedPrice =
    typeof raw.suggestedPrice === "number" && Number.isFinite(raw.suggestedPrice) && raw.suggestedPrice > 0
      ? Number(raw.suggestedPrice.toFixed(2))
      : fallbackPrice;

  return {
    seoTitle: padTitleTo80(raw.seoTitle ?? product.title, product.title),
    descriptionHtml: raw.descriptionHtml?.trim() || `<p>${product.description ?? product.title}</p>`,
    suggestedPrice,
    currency: raw.currency?.trim() || currency,
    itemSpecifics,
    categorySuggestion: raw.categorySuggestion?.trim() || "General",
    categoryId: null,
    condition,
    brand: UNBRANDED,
  };
}
