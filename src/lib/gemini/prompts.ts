import "server-only";

import type { ListingProductSource } from "@/types/listing-generator";

export function buildListingPrompt(
  product: ListingProductSource,
  recommendedPrice?: number,
): string {
  const price =
    recommendedPrice ?? Number((product.price * 2.5).toFixed(2));
  const currency = product.currency === "USD" ? "GBP" : product.currency;

  return `You are an expert eBay UK listing copywriter for dropshippers.

Create a complete, SEO-optimized eBay listing from this AliExpress product data.

PRODUCT DATA:
- Title: ${product.title}
- Price: ${product.price} ${product.currency}
- Description: ${product.description ?? product.title}
- Images available: ${product.images.length}
- URL: ${product.productUrl}

RULES FOR seoTitle:
- EXACTLY 80 characters — count carefully and fill all 80 with relevant keywords
- Start with the most searchable main keyword first
- Include key feature and condition (New)
- No brand names — never use Nike, Apple, Samsung, etc.
- No ALL CAPS spam, no emojis
- Example length/style: "Portable USB Folding Fan Digital Display High Speed Handheld Rechargeable Mini"

RULES FOR descriptionHtml:
- Valid HTML for eBay only: h2, p, ul, li, strong
- Start with H2 containing the product name
- Key features as bullet points with bold labels (e.g. <strong>Material:</strong> ...)
- Include Compatibility section if relevant
- Include "What's in the box" section
- Include a professional seller guarantee statement
- 200-450 words, professional English, no grammar errors
- Do NOT mention AliExpress, dropshipping, or wholesale sources anywhere

RULES FOR itemSpecifics:
- ALWAYS include Brand: Unbranded
- ALWAYS include MPN: Does Not Apply
- ALWAYS include Condition matching the condition field
- Add as many relevant specifics as possible (Type, Material, Color, Size, Features, etc.)
- Minimum 10 specifics — more specifics = better eBay search ranking

OTHER RULES:
- suggestedPrice: use ${price} ${currency}
- categorySuggestion: best eBay UK category path as text
- condition: "New" unless clearly used product
- brand: ALWAYS "Unbranded"

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
