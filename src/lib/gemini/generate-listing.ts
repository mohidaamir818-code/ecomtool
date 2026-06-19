import "server-only";

import { generateGeminiJson } from "@/lib/gemini/client";
import { buildListingPrompt } from "@/lib/gemini/prompts";
import type { GeneratedListing, ListingProductSource } from "@/types/listing-generator";

interface GeminiListingResponse {
  seoTitle?: string;
  descriptionHtml?: string;
  suggestedPrice?: number;
  currency?: string;
  itemSpecifics?: Array<{ name?: string; value?: string }>;
  categorySuggestion?: string;
  condition?: string;
  brand?: string;
}

function normalizeTitle(title: string): string {
  return title.trim().slice(0, 80);
}

export async function generateEbayListing(product: ListingProductSource): Promise<GeneratedListing> {
  const fallbackPrice = Number((product.price * 2.5).toFixed(2));
  const currency = product.currency === "USD" ? "GBP" : product.currency;

  const raw = await generateGeminiJson<GeminiListingResponse>(buildListingPrompt(product));

  const itemSpecifics = (raw.itemSpecifics ?? [])
    .map((entry) => ({
      name: String(entry.name ?? "").trim(),
      value: String(entry.value ?? "").trim(),
    }))
    .filter((entry) => entry.name && entry.value);

  if (!itemSpecifics.some((entry) => entry.name.toLowerCase() === "brand")) {
    itemSpecifics.unshift({
      name: "Brand",
      value: raw.brand?.trim() || "Unbranded",
    });
  }

  if (!itemSpecifics.some((entry) => entry.name.toLowerCase() === "condition")) {
    itemSpecifics.unshift({
      name: "Condition",
      value: raw.condition?.trim() || "New",
    });
  }

  const suggestedPrice =
    typeof raw.suggestedPrice === "number" && Number.isFinite(raw.suggestedPrice) && raw.suggestedPrice > 0
      ? Number(raw.suggestedPrice.toFixed(2))
      : fallbackPrice;

  return {
    seoTitle: normalizeTitle(raw.seoTitle ?? product.title),
    descriptionHtml: raw.descriptionHtml?.trim() || `<p>${product.description ?? product.title}</p>`,
    suggestedPrice,
    currency: raw.currency?.trim() || currency,
    itemSpecifics,
    categorySuggestion: raw.categorySuggestion?.trim() || "General",
    categoryId: null,
    condition: raw.condition?.trim() || "New",
    brand: raw.brand?.trim() || "Unbranded",
  };
}
