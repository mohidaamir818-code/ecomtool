import "server-only";

import type { ListingProductSource } from "@/types/listing-generator";

export function buildListingPrompt(product: ListingProductSource): string {
  const suggestedPrice = Number((product.price * 2.5).toFixed(2));

  return `You are an expert eBay UK listing copywriter for dropshippers.

Create a complete eBay listing from this AliExpress product data.

PRODUCT DATA:
- Title: ${product.title}
- Price: ${product.price} ${product.currency}
- Description: ${product.description ?? product.title}
- Images: ${product.images.slice(0, 8).join(", ") || "none"}
- URL: ${product.productUrl}

RULES:
- seoTitle: max 80 characters, keyword-rich, no ALL CAPS spam, no emojis
- descriptionHtml: valid HTML for eBay (h2, p, ul/li, strong). 150-400 words. Mention features and benefits. Do NOT mention AliExpress or dropshipping.
- suggestedPrice: use ${suggestedPrice} ${product.currency === "USD" ? "GBP" : product.currency} (AliExpress cost x 2.5). If source currency is USD, convert mentally to GBP for eBay UK.
- itemSpecifics: array of { "name": string, "value": string } with at least Brand, Condition, Type, Material (use "Unbranded" if unknown)
- categorySuggestion: best eBay UK category path as text (e.g. "Home & Garden > Kitchen")
- condition: one of "New", "New other", "Used"
- brand: ALWAYS set to "Unbranded" — never use a real brand name

Return ONLY valid JSON with this exact shape:
{
  "seoTitle": string,
  "descriptionHtml": string,
  "suggestedPrice": number,
  "currency": string,
  "itemSpecifics": [{ "name": string, "value": string }],
  "categorySuggestion": string,
  "condition": string,
  "brand": string
}`;
}

export function buildVeroCheckPrompt(product: ListingProductSource, title?: string): string {
  return `You are an eBay VeRO and policy compliance expert for UK sellers.

Analyze this product for listing safety on eBay UK.

PRODUCT:
- Title: ${title ?? product.title}
- AliExpress title: ${product.title}
- Description: ${product.description ?? "n/a"}
- Price: ${product.price} ${product.currency}

Check for:
1. Counterfeit or high-risk branded goods (Nike, Apple, Samsung, Disney, Louis Vuitton, etc.)
2. eBay banned or restricted categories (weapons, drugs, replicas, etc.)
3. Restricted words in title (Replica, 1:1, OEM fake, etc.)

Return ONLY valid JSON:
{
  "safe": boolean,
  "isCounterfeitOrBranded": boolean,
  "isBannedCategory": boolean,
  "hasRestrictedWords": boolean,
  "warnings": string[],
  "summary": string
}

If ANY risk is high, set safe to false and explain in summary.`;
}
