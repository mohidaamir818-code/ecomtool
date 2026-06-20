import "server-only";

import type { ListingProductSource } from "@/types/listing-generator";
import {
  CANONICAL_ITEM_SPECIFIC_NAMES,
  DEFAULT_EBAY_CONDITION,
  extractVariantAttributes,
  MPN_DOES_NOT_APPLY,
  SEE_DESCRIPTION,
  UNBRANDED,
} from "@/lib/listings/item-specifics";

export function buildListingPrompt(
  product: ListingProductSource,
  recommendedPrice?: number,
): string {
  const price =
    recommendedPrice ?? Number((product.price * 2.5).toFixed(2));
  const currency = product.currency === "USD" ? "GBP" : product.currency;
  const { colors, sizes } = extractVariantAttributes(product.variants);
  const variantLabels = product.variants?.map((variant) => variant.label).join(", ") ?? "None";

  const fieldList = CANONICAL_ITEM_SPECIFIC_NAMES.join(", ");

  return `You are an expert eBay UK listing copywriter for online sellers.

Create a complete, SEO-optimized eBay listing from this product data.

PRODUCT DATA:
- Title: ${product.title}
- Price: ${product.price} ${product.currency}
- Description: ${product.description ?? product.title}
- Images available: ${product.images.length}
- Variant labels: ${variantLabels}
- Detected colors: ${colors.length > 0 ? colors.join(", ") : "none"}
- Detected sizes: ${sizes.length > 0 ? sizes.join(", ") : "none"}

RULES FOR seoTitle:
- EXACTLY 80 characters — count carefully and fill all 80 with relevant keywords
- Start with the most searchable main keyword first
- Include key feature and condition (New)
- No brand names — never use Nike, Apple, Samsung, etc.
- No ALL CAPS spam, no emojis
- NEVER mention suppliers, marketplaces, China, dropshipping, wholesale, warehouses, or processing times

RULES FOR descriptionHtml:
- Valid HTML for eBay only: h2, p, ul, li, strong
- Start with H2 containing the product name
- Key features as bullet points with bold labels (e.g. <strong>Material:</strong> ...)
- Include Compatibility section if relevant
- Include "What's in the box" section
- Include a professional seller guarantee statement
- 200-450 words, professional English, no grammar errors
- NEVER mention: AliExpress, Alibaba, China, dropshipping, supplier, wholesale, DHgate, Temu, Made in China, Ships from China, processing time, warehouse

RULES FOR itemSpecifics:
- Return ALL of these exact field names: ${fieldList}
- Brand: always "${UNBRANDED}"
- MPN: always "${MPN_DOES_NOT_APPLY}"
- Unit: default "Unit"
- Number of Items: default "1"
- Color: use variant colors when available (${colors.join(", ") || "infer from product"})
- Size: use variant sizes when available (${sizes.join(", ") || "infer from product"})
- For any field you cannot determine confidently, use "${SEE_DESCRIPTION}" — NEVER use "Unknown"
- NEVER include Country/Region of Manufacture
- Do NOT include Condition in itemSpecifics (condition is a separate field)

OTHER RULES:
- suggestedPrice: use ${price} ${currency}
- categorySuggestion: best eBay UK category path as text
- condition: "${DEFAULT_EBAY_CONDITION}" unless clearly used product
- brand: ALWAYS "${UNBRANDED}"

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
- Source title: ${product.title}
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
