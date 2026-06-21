import "server-only";

import { buildDescriptionHtmlWithImages, getSelectedDescriptionPhotos } from "@/features/listings/lib/draft-utils";
import { getAppOrigin } from "@/lib/env";
import { requireConfirmedLocation } from "@/lib/ebay/inventory-location";
import {
  assertUniqueVariantSkus,
  resolveGroupSkuKey,
  resolveVariantSkuForEbay,
} from "@/lib/listings/internal-sku";
import {
  aspectsFromListingSpecifics,
  buildAspectSafeDefaults,
  buildDefaultEbayUkAspects,
  enforceProtectedEbayAspects,
  extractColoursAndSizesFromLabels,
  filterAspectsForCategory,
  getSafeAspectDefault,
  mergeEbayAspects,
  normalizeAspectNameForMarketplace,
  resolveRequiredEbayAspects,
} from "@/lib/listings/item-specifics";
import {
  buildEbayListingUrl,
  getSellerMarketplaceId,
  resolveMarketplaceConfig,
  type EbayMarketplaceId,
} from "@/lib/ebay/marketplace";
import { getEbayUserAccessToken } from "@/lib/ebay/oauth-user";
import type {
  EbayBusinessPolicies,
  EbayCategorySuggestion,
  GeneratedListing,
  ListingDraft,
  ListingProductSource,
  ListOnEbayResult,
  VolumePromotionTier,
} from "@/types/listing-generator";
import { DEFAULT_PROMOTIONS } from "@/types/listing-generator";

const EBAY_API_BASE = "https://api.ebay.com";
const MAX_PHOTOS = 24;
const MAX_ASPECT_RETRIES = 5;

function taxonomyHeaders(token: string, marketplaceId: EbayMarketplaceId): HeadersInit {
  const { acceptLanguage } = resolveMarketplaceConfig(marketplaceId);
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Accept-Language": acceptLanguage,
  };
}

function inventoryHeaders(token: string, marketplaceId: EbayMarketplaceId): HeadersInit {
  const { contentLanguage, acceptLanguage } = resolveMarketplaceConfig(marketplaceId);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Content-Language": contentLanguage,
    "Accept-Language": acceptLanguage,
  };
}

export class EbayApiError extends Error {
  readonly status: number;
  readonly rawBody: string;
  readonly url: string;
  readonly missingField?: string;

  constructor(
    message: string,
    status: number,
    rawBody: string,
    url: string,
    missingField?: string,
  ) {
    super(message);
    this.name = "EbayApiError";
    this.status = status;
    this.rawBody = rawBody;
    this.url = url;
    this.missingField = missingField;
  }
}

function redactHeaders(headers: HeadersInit): Record<string, string> {
  const result: Record<string, string> = {};

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key] = key.toLowerCase() === "authorization" ? "Bearer [REDACTED]" : value;
    });
    return result;
  }

  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      result[key] = key.toLowerCase() === "authorization" ? "Bearer [REDACTED]" : value;
    }
    return result;
  }

  for (const [key, value] of Object.entries(headers)) {
    result[key] = key.toLowerCase() === "authorization" ? "Bearer [REDACTED]" : String(value);
  }

  return result;
}

async function ebayFetch(
  label: string,
  url: string,
  init: RequestInit,
): Promise<{ response: Response; bodyText: string }> {
  console.log(`[eBay ${label}] Calling:`, url);
  console.log(`[eBay ${label}] Headers:`, JSON.stringify(redactHeaders(init.headers ?? {})));
  if (init.body) console.log(`[eBay ${label}] Body:`, init.body);

  const response = await fetch(url, init);
  const bodyText = await response.text();

  console.log(`[eBay ${label}] Status:`, response.status);
  console.log(`[eBay ${label}] Body:`, bodyText);

  return { response, bodyText };
}

export function parseEbayErrorDetails(
  bodyText: string,
  fallback = "eBay API error",
): {
  message: string;
  missingField?: string;
  errorId?: number;
  errors?: unknown[];
} {
  try {
    const data = JSON.parse(bodyText) as {
      errors?: Array<{
        errorId?: number;
        message?: string;
        longMessage?: string;
        parameters?: Array<{ name?: string; value?: string }>;
      }>;
    };
    const first = data.errors?.[0];
    const missingField = extractMissingAspectField(bodyText) ?? undefined;
    const message = first?.longMessage ?? first?.message ?? fallback;
    return {
      message,
      missingField,
      errorId: first?.errorId,
      errors: data.errors,
    };
  } catch {
    return { message: bodyText || fallback };
  }
}

export function extractMissingAspectField(bodyText: string): string | null {
  try {
    const data = JSON.parse(bodyText) as {
      errors?: Array<{
        errorId?: number;
        message?: string;
        longMessage?: string;
        parameters?: Array<{ name?: string; value?: string }>;
      }>;
    };
    const first = data.errors?.[0];
    if (!first) return null;

    const messageText = `${first.message ?? ""} ${first.longMessage ?? ""}`;
    const combined = messageText.toLowerCase();
    const hasOfferId = first.parameters?.some(
      (param) => param.name === "offerId" && param.value,
    );
    if (combined.includes("already exists") || hasOfferId) return null;

    const isMissingAspect =
      first.errorId === 25002 ||
      combined.includes("item specific") ||
      (combined.includes("missing") && combined.includes("specific"));

    if (!isMissingAspect) return null;

    const paramField = first.parameters?.find((param) => param.name === "2")?.value?.trim();
    if (paramField) return paramField;

    const messageMatch = messageText.match(/item specifics?\s+(.+?)\s+is missing/i);
    if (messageMatch?.[1]?.trim()) {
      return messageMatch[1].trim();
    }

    return null;
  } catch {
    return null;
  }
}

function patchMissingAspectOverride(
  aspectOptions: EbayAspectBuildOptions,
  missingField: string,
  attempt: number,
): void {
  if (!aspectOptions.aspectOverrides) {
    aspectOptions.aspectOverrides = {};
  }
  const fieldKey =
    aspectOptions.marketplaceId === "EBAY_GB"
      ? normalizeAspectNameForMarketplace(missingField, aspectOptions.marketplaceId)
      : missingField;

  const extracted = aspectOptions.extractedAspects;
  const safeDefaults = extracted
    ? buildAspectSafeDefaults({ colors: extracted.colours, sizes: extracted.sizes })
    : null;
  const safeValue =
    safeDefaults?.[fieldKey] ?? getSafeAspectDefault(fieldKey);

  aspectOptions.aspectOverrides[fieldKey] = safeValue;
  console.log(`Auto-retry ${attempt}: fixing ${fieldKey}`, safeValue);
}

async function executeWithMissingAspectRetry(
  aspectOptions: EbayAspectBuildOptions,
  execute: () => Promise<{ url: string; response: Response; bodyText: string }>,
  fallbackMessage: string,
  label: string,
): Promise<void> {
  let attempts = 0;

  while (true) {
    const { url, response, bodyText } = await execute();
    if (response.ok) return;

    if (attempts < MAX_ASPECT_RETRIES) {
      const missingField = extractMissingAspectField(bodyText);
      if (missingField) {
        patchMissingAspectOverride(aspectOptions, missingField, attempts + 1);
        attempts++;
        continue;
      }
    }

    throwEbayApiError(url, response, bodyText, fallbackMessage);
  }
}

async function executePublishWithAspectRetry(
  aspectOptions: EbayAspectBuildOptions,
  reupsertInventory: () => Promise<void>,
  execute: () => Promise<{ url: string; response: Response; bodyText: string }>,
  fallbackMessage: string,
  label: string,
): Promise<{ listingId: string | null }> {
  let attempts = 0;

  while (true) {
    const { url, response, bodyText } = await execute();

    if (response.ok) {
      const data = parseJsonSafe(bodyText, {} as { listingId?: string });
      return { listingId: data.listingId ?? null };
    }

    if (attempts < MAX_ASPECT_RETRIES) {
      const missingField = extractMissingAspectField(bodyText);
      if (missingField) {
        console.log(`[eBay ${label}] Missing aspect "${missingField}", re-upserting and retrying`);
        patchMissingAspectOverride(aspectOptions, missingField, attempts + 1);
        await reupsertInventory();
        attempts++;
        continue;
      }
    }

    throwEbayApiError(url, response, bodyText, fallbackMessage);
  }
}

function parseJsonSafe<T>(bodyText: string, fallback: T): T {
  if (!bodyText.trim()) return fallback;
  try {
    return JSON.parse(bodyText) as T;
  } catch {
    return fallback;
  }
}

function throwEbayApiError(url: string, response: Response, bodyText: string, fallback: string): never {
  const details = parseEbayErrorDetails(bodyText, fallback);
  throw new EbayApiError(
    details.message,
    response.status,
    bodyText,
    url,
    details.missingField ?? extractMissingAspectField(bodyText) ?? undefined,
  );
}

function mapCondition(condition: string): string {
  const normalized = condition.toLowerCase();
  if (normalized.includes("used")) return "USED_EXCELLENT";
  if (normalized.includes("new with defects")) return "NEW_WITH_DEFECTS";
  if (normalized.includes("new without tags")) return "NEW_OTHER";
  if (normalized.includes("new with tags")) return "NEW";
  if (normalized.includes("new other")) return "NEW_OTHER";
  return "NEW";
}

function resolveVariantQuantity(variant: ListingDraft["variants"][number]): number {
  return variant.quantity >= 1 ? variant.quantity : 1;
}

function normalizeImageUrls(urls: string[]): string[] {
  return urls
    .slice(0, MAX_PHOTOS)
    .map((url) => url.replace(/^\/\//, "https://"))
    .filter(Boolean);
}

const EBAY_DESCRIPTION_MAX_LENGTH = 3999;

const EBAY_DESCRIPTION_FALLBACK = "Please see product images for details.";

const EBAY_DESCRIPTION_EMPTY_FALLBACK =
  "Quality product. Please see images for full details. Contact us with any questions.";

function cleanDescription(html: string): string {
  const withoutTags = html.replace(/<[^>]*>/g, " ");
  const cleaned = withoutTags.replace(/\s+/g, " ").trim();
  return cleaned.substring(0, EBAY_DESCRIPTION_MAX_LENGTH);
}

function resolveEbayDescription(html: string | null | undefined): string {
  const raw = html?.trim();
  let description = raw ? cleanDescription(raw) : EBAY_DESCRIPTION_FALLBACK;

  if (!description || description.length === 0) {
    description = EBAY_DESCRIPTION_EMPTY_FALLBACK;
  }

  return description;
}

type AspectVariantSource = { label?: string; name?: string };

function getAspectVariantSources(aspectOptions: EbayAspectBuildOptions): AspectVariantSource[] {
  const seen = new Set<string>();
  const variants: AspectVariantSource[] = [];

  for (const variant of aspectOptions.product?.variants ?? []) {
    const label = variant.label?.trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    variants.push({ label });
  }

  for (const variant of aspectOptions.variantDrafts ?? []) {
    const label = variant.label?.trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    variants.push({ label });
  }

  return variants;
}

const SKU_SIZE_PATTERNS = [
  /^(XXS|XS|S|M|L|XL|2XL|3XL|4XL|5XL|XXL|XXXL|XXXXL)$/i,
  /^\d+$/,
  /^\d+\s*-\s*\d+$/,
  /^(small|medium|large|extra\s*large)$/i,
  /^(one size|free size|universal)$/i,
  /^\d+(cm|mm|inch|inches|kg|g|oz|ml|l)$/i,
  /^(EU|UK|US)\s*\d+$/i,
  /^\d+\/\d+$/,
] as const;

function isSkuSizePart(part: string): boolean {
  return SKU_SIZE_PATTERNS.some((pattern) => pattern.test(part));
}

function parseSkuColourAndSizeFromLabel(label: string): { colour: string; size: string } {
  const parts = label
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { colour: "Multicolor", size: "One Size" };
  }

  const firstPart = parts[0];
  const isFirstSize = isSkuSizePart(firstPart);

  let colour = "Multicolor";
  let size = "One Size";

  if (!isFirstSize && firstPart) {
    colour = firstPart;
  }

  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    size = lastPart;
  } else if (isFirstSize) {
    size = firstPart;
  }

  return { colour, size };
}

function variantComboKey(label: string): string {
  const { colour, size } = parseSkuColourAndSizeFromLabel(label);
  return `${colour.trim().toLowerCase()}|${size.trim().toLowerCase()}`;
}

function dedupeVariationValues(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function dedupeVariantsByCombo(
  variants: ListingDraft["variants"],
): ListingDraft["variants"] {
  const seen = new Set<string>();
  const result: ListingDraft["variants"] = [];
  for (const variant of variants) {
    const key = variantComboKey(variant.label ?? "");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(variant);
  }
  return result;
}

function buildVariationSpecsFromVariants(
  aspectOptions: EbayAspectBuildOptions,
  marketplaceId: EbayMarketplaceId,
): { colourKey: "Colour" | "Color"; colours: string[]; sizes: string[] } {
  const colourKey = marketplaceId === "EBAY_GB" ? "Colour" : "Color";
  const labels = (aspectOptions.variantDrafts ?? [])
    .map((variant) => variant.label?.trim() ?? "")
    .filter(Boolean);
  const colours: string[] = [];
  const sizes: string[] = [];

  for (const label of labels) {
    const { colour, size } = parseSkuColourAndSizeFromLabel(label);
    if (!colours.some((entry) => entry.toLowerCase() === colour.toLowerCase())) {
      colours.push(colour);
    }
    if (!sizes.some((entry) => entry.toLowerCase() === size.toLowerCase())) {
      sizes.push(size);
    }
  }

  return {
    colourKey,
    colours: dedupeVariationValues(colours.length > 0 ? colours : ["Multicolor"]),
    sizes: dedupeVariationValues(sizes.length > 0 ? sizes : ["One Size"]),
  };
}

const MULTI_SKU_SHARED_ASPECT_KEYS = new Set([
  "Brand",
  "MPN",
  "Department",
  "Age Group",
  "Material",
  "Pattern",
  "Occasion",
  "Season",
  "Style",
  "Fit",
  "Country/Region of Manufacture",
]);

function isMultiSkuListing(aspectOptions: EbayAspectBuildOptions): boolean {
  return (aspectOptions.variantDrafts?.length ?? 0) > 1;
}

function buildMultiSkuInventoryItemAspects(
  aspects: Record<string, string[]>,
): Record<string, string[]> {
  const filtered: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(aspects)) {
    if (MULTI_SKU_SHARED_ASPECT_KEYS.has(key) && values.length > 0) {
      filtered[key] = values;
    }
  }
  return filtered;
}

function applyNuclearColourSizeFallback(
  aspects: Record<string, string[]>,
  variants: AspectVariantSource[],
  marketplaceId: EbayMarketplaceId,
): Record<string, string[]> {
  const colourKey = marketplaceId === "EBAY_GB" ? "Colour" : "Color";
  const alternateColourKey = colourKey === "Colour" ? "Color" : "Colour";
  const labels = variants.map((variant) => String(variant.label ?? variant.name ?? ""));
  const { colors: colours, sizes: extractedSizes } = extractColoursAndSizesFromLabels(labels);

  console.log("=== DEBUG COLOUR EXTRACTION ===");
  console.log("Raw variants:", JSON.stringify(variants));
  console.log("Extracted colours:", JSON.stringify(colours));
  console.log("Final aspects Colour:", aspects.Colour);
  console.log("=== END DEBUG ===");

  if (
    !aspects[colourKey] ||
    aspects[colourKey].length === 0 ||
    aspects[colourKey][0] === undefined
  ) {
    const colourFromVariants = variants
      .map((variant) => {
        const parts = String(variant.label ?? variant.name ?? "")
          .split("/")
          .map((part) => part.trim());
        return parts[0];
      })
      .filter((colour) => colour && colour.length > 0 && colour !== "undefined");

    aspects[colourKey] =
      colourFromVariants.length > 0 ? [...new Set(colourFromVariants)] : ["Multicolor"];
  }

  delete aspects[alternateColourKey];

  if (!aspects.Size || aspects.Size.length === 0) {
    const sizeFromVariants = variants
      .map((variant) => {
        const parts = String(variant.label ?? variant.name ?? "")
          .split("/")
          .map((part) => part.trim());
        return parts[parts.length - 1];
      })
      .filter((size) => size && size.length > 0 && size !== "undefined");

    aspects.Size =
      sizeFromVariants.length > 0 ? [...new Set(sizeFromVariants)] : ["One Size"];
  } else if (extractedSizes.length > 0 && aspects.Size.every((size) => !size?.trim())) {
    aspects.Size = extractedSizes;
  }

  console.log("FINAL aspects:", JSON.stringify(aspects));

  return aspects;
}

function resolveGroupColourSizeArrays(
  aspectOptions: EbayAspectBuildOptions,
  marketplaceId: EbayMarketplaceId,
): { colourKey: "Colour" | "Color"; colours: string[]; sizes: string[] } {
  const colourKey = marketplaceId === "EBAY_GB" ? "Colour" : "Color";
  const variants = getAspectVariantSources(aspectOptions);
  const labels = variants.map((variant) => String(variant.label ?? variant.name ?? ""));

  let { colors: colours, sizes } = extractColoursAndSizesFromLabels(labels);

  if (colours.length === 0 && aspectOptions.extractedAspects?.colours.length) {
    colours = aspectOptions.extractedAspects.colours;
  }
  if (sizes.length === 0 && aspectOptions.extractedAspects?.sizes.length) {
    sizes = aspectOptions.extractedAspects.sizes;
  }

  if (colours.length === 0) {
    colours = [
      ...new Set(
        variants
          .map((variant) => String(variant.label ?? variant.name ?? "").split("/")[0]?.trim())
          .filter(Boolean),
      ),
    ];
  }

  if (sizes.length === 0) {
    sizes = [
      ...new Set(
        variants
          .map((variant) => {
            const parts = String(variant.label ?? variant.name ?? "")
              .split("/")
              .map((part) => part.trim());
            return parts[parts.length - 1];
          })
          .filter(Boolean),
      ),
    ];
  }

  return {
    colourKey,
    colours: colours.length > 0 ? colours : ["Multicolor"],
    sizes: sizes.length > 0 ? sizes : ["One Size"],
  };
}

function buildInventoryItemGroupBody(
  groupKey: string,
  listing: GeneratedListing,
  imageUrls: string[],
  variantSkus: string[],
  aspectOptions: EbayAspectBuildOptions,
  marketplaceId: EbayMarketplaceId,
): {
  inventoryItemGroupKey: string;
  variantSKUs: string[];
  title: string;
  description: string;
  imageUrls: string[];
  aspects: Record<string, string[]>;
  variesBy: {
    aspectsImageVariesBy: string[];
    specifications: Array<{ name: string; values: string[] }>;
  };
} {
  const { colourKey, colours, sizes } = buildVariationSpecsFromVariants(aspectOptions, marketplaceId);
  let finalColours = colours;
  let finalSizes = sizes;

  const baseAspects = buildEbayAspects(listing, aspectOptions);
  const department = baseAspects.Department?.[0] ?? "Unisex";

  const aspects = buildMultiSkuInventoryItemAspects({
    ...baseAspects,
    Brand: ["Unbranded"],
    MPN: ["Does Not Apply"],
    Department: [department],
    "Age Group": baseAspects["Age Group"]?.length ? baseAspects["Age Group"] : ["Adult"],
    Material: baseAspects.Material?.length ? baseAspects.Material : ["See Description"],
  });

  if (finalColours.length === 0 || (finalColours.length === 1 && finalColours[0] === "Multicolor")) {
    const emergencyColours = [
      ...new Set(
        aspectOptions.variantDrafts
          ?.map((v) => v.label?.split("/")[0]?.trim())
          .filter((c): c is string => !!c && c.length > 0) ?? [],
      ),
    ];
    if (emergencyColours.length > 0) {
      finalColours = emergencyColours;
    }
  }

  if (finalSizes.length === 0 || (finalSizes.length === 1 && finalSizes[0] === "One Size")) {
    const emergencySizes = [
      ...new Set(
        aspectOptions.variantDrafts
          ?.map((v) => {
            const parts = v.label?.split("/") ?? [];
            return parts[parts.length - 1]?.trim();
          })
          .filter((s): s is string => !!s && s.length > 0) ?? [],
      ),
    ];
    if (emergencySizes.length > 0) {
      finalSizes = emergencySizes;
    }
  }

  finalColours = dedupeVariationValues(finalColours);
  finalSizes = dedupeVariationValues(finalSizes);

  const variesBy = {
    aspectsImageVariesBy: [colourKey],
    specifications: [
      { name: colourKey, values: finalColours },
      { name: "Size", values: finalSizes },
    ],
  };

  return {
    inventoryItemGroupKey: groupKey,
    variantSKUs: variantSkus,
    title: listing.seoTitle,
    description: resolveEbayDescription(listing.descriptionHtml),
    imageUrls: normalizeImageUrls(imageUrls),
    aspects,
    variesBy,
  };
}

function ensureGroupBodyHasAspects(
  groupBody: ReturnType<typeof buildInventoryItemGroupBody>,
  aspectOptions: EbayAspectBuildOptions,
  marketplaceId: EbayMarketplaceId,
): void {
  const { colourKey, colours, sizes } = buildVariationSpecsFromVariants(aspectOptions, marketplaceId);
  const safeColours = dedupeVariationValues(colours.length > 0 ? colours : ["Multicolor"]);
  const safeSizes = dedupeVariationValues(sizes.length > 0 ? sizes : ["One Size"]);
  const alternateColourKey = colourKey === "Colour" ? "Color" : "Colour";

  if (!groupBody.aspects) {
    groupBody.aspects = {};
  }

  delete groupBody.aspects[colourKey];
  delete groupBody.aspects[alternateColourKey];
  delete groupBody.aspects.Size;

  groupBody.aspects = buildMultiSkuInventoryItemAspects({
    ...groupBody.aspects,
    Brand: groupBody.aspects.Brand?.length ? groupBody.aspects.Brand : ["Unbranded"],
    MPN: groupBody.aspects.MPN?.length ? groupBody.aspects.MPN : ["Does Not Apply"],
    Department: groupBody.aspects.Department?.length ? groupBody.aspects.Department : ["Unisex"],
    "Age Group": groupBody.aspects["Age Group"]?.length ? groupBody.aspects["Age Group"] : ["Adult"],
    Material: groupBody.aspects.Material?.length ? groupBody.aspects.Material : ["See Description"],
  });

  const existingColourSpec = groupBody.variesBy?.specifications?.find(
    (spec) => spec.name === colourKey,
  )?.values;
  const existingSizeSpec = groupBody.variesBy?.specifications?.find(
    (spec) => spec.name === "Size",
  )?.values;

  groupBody.variesBy = {
    aspectsImageVariesBy: [colourKey],
    specifications: [
      {
        name: colourKey,
        values: dedupeVariationValues(existingColourSpec?.length ? existingColourSpec : safeColours),
      },
      {
        name: "Size",
        values: dedupeVariationValues(existingSizeSpec?.length ? existingSizeSpec : safeSizes),
      },
    ],
  };
}

export interface EbayAspectBuildOptions {
  marketplaceId: EbayMarketplaceId;
  product?: ListingProductSource;
  variantDrafts?: ListingDraft["variants"];
  categoryAspectNames?: string[];
  aspectOverrides?: Record<string, string[]>;
  extractedAspects?: { colours: string[]; sizes: string[] };
}

export function buildEbayAspects(
  listing: GeneratedListing,
  options: EbayAspectBuildOptions,
): Record<string, string[]> {
  const {
    marketplaceId,
    product,
    variantDrafts,
    categoryAspectNames = [],
    aspectOverrides,
  } = options;

  const context = {
    listing,
    product,
    variantDrafts,
    marketplaceId,
  };

  let aspects: Record<string, string[]>;

  if (marketplaceId === "EBAY_GB") {
    const defaults = buildDefaultEbayUkAspects(context);
    const aiAspects = aspectsFromListingSpecifics(listing, marketplaceId);
    aspects = mergeEbayAspects(defaults, aiAspects, aspectOverrides);
    aspects = enforceProtectedEbayAspects(aspects, context);
    console.log("=== ASPECTS BEING SENT ===");
    console.log(JSON.stringify(aspects, null, 2));
    return aspects;
  }

  const defaults = resolveRequiredEbayAspects(context);
  const aiAspects = aspectsFromListingSpecifics(listing, marketplaceId);
  aspects = mergeEbayAspects(defaults, aiAspects, aspectOverrides);
  aspects = enforceProtectedEbayAspects(aspects, context);
  aspects = filterAspectsForCategory(aspects, categoryAspectNames);
  console.log("=== ASPECTS BEING SENT ===");
  console.log(JSON.stringify(aspects, null, 2));
  return aspects;
}

function buildVolumePricing(promotions: VolumePromotionTier[]) {
  return promotions
    .filter((tier) => tier.enabled && tier.discountPercent > 0)
    .map((tier) => ({
      quantity: tier.quantity,
      discountPercentage: tier.discountPercent.toFixed(2),
    }));
}

export async function getCategorySuggestions(
  token: string,
  query: string,
  marketplaceId?: EbayMarketplaceId,
): Promise<EbayCategorySuggestion[]> {
  const config = resolveMarketplaceConfig(marketplaceId);
  const resolvedMarketplaceId = config.marketplaceId;
  const url = new URL(
    `${EBAY_API_BASE}/commerce/taxonomy/v1/category_tree/${config.categoryTreeId}/get_category_suggestions`,
  );
  url.searchParams.set("q", query.slice(0, 80));

  const requestUrl = url.toString();
  const { response, bodyText } = await ebayFetch("taxonomy/suggestions", requestUrl, {
    headers: taxonomyHeaders(token, resolvedMarketplaceId),
    cache: "no-store",
  });

  if (!response.ok) return [];

  const data = parseJsonSafe(bodyText, {} as {
    categorySuggestions?: Array<{
      category?: { categoryId?: string; categoryName?: string };
      categoryTreeNodeAncestors?: Array<{ categoryName?: string }>;
    }>;
  });

  return (data.categorySuggestions ?? [])
    .map((entry) => {
      const categoryId = entry.category?.categoryId;
      const categoryName = entry.category?.categoryName;
      if (!categoryId || !categoryName) return null;

      const ancestors = (entry.categoryTreeNodeAncestors ?? [])
        .map((node) => node.categoryName)
        .filter(Boolean)
        .reverse();

      return {
        categoryId,
        categoryName,
        categoryPath: [...ancestors, categoryName].join(" > "),
      } satisfies EbayCategorySuggestion;
    })
    .filter((entry): entry is EbayCategorySuggestion => entry !== null);
}

export async function getItemAspectsForCategory(
  token: string,
  categoryId: string,
  marketplaceId?: EbayMarketplaceId,
): Promise<string[]> {
  const config = resolveMarketplaceConfig(marketplaceId);
  const resolvedMarketplaceId = config.marketplaceId;
  const url = new URL(
    `${EBAY_API_BASE}/commerce/taxonomy/v1/category_tree/${config.categoryTreeId}/get_item_aspects_for_category`,
  );
  url.searchParams.set("category_id", categoryId);

  const requestUrl = url.toString();
  const { response, bodyText } = await ebayFetch("taxonomy/aspects", requestUrl, {
    headers: taxonomyHeaders(token, resolvedMarketplaceId),
    cache: "no-store",
  });

  if (!response.ok) return [];

  const data = parseJsonSafe(bodyText, {} as {
    aspects?: Array<{ localizedAspectName?: string }>;
  });

  return (data.aspects ?? [])
    .map((aspect) => aspect.localizedAspectName?.trim())
    .filter((name): name is string => Boolean(name));
}

async function resolveCategoryId(
  token: string,
  listing: GeneratedListing,
  marketplaceId: EbayMarketplaceId,
): Promise<string> {
  if (listing.categoryId) return listing.categoryId;

  const suggestions = await getCategorySuggestions(
    token,
    listing.categorySuggestion || listing.seoTitle,
    marketplaceId,
  );

  const categoryId = suggestions[0]?.categoryId;
  if (!categoryId) {
    throw new Error("Could not resolve an eBay category for this product.");
  }

  return categoryId;
}

async function upsertInventoryItem(
  token: string,
  marketplaceId: EbayMarketplaceId,
  sku: string,
  listing: GeneratedListing,
  imageUrls: string[],
  quantity: number,
  aspectOptions: EbayAspectBuildOptions,
  variantLabel?: string,
  gtin?: string,
): Promise<void> {
  const requestUrl = `${EBAY_API_BASE}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`;

  await executeWithMissingAspectRetry(
    aspectOptions,
    async () => {
      let aspects = buildEbayAspects(listing, aspectOptions);

      if (isMultiSkuListing(aspectOptions)) {
        aspects = buildMultiSkuInventoryItemAspects(aspects);
      } else {
        if (variantLabel) {
          const colourKey = marketplaceId === "EBAY_GB" ? "Colour" : "Color";
          const alternateColourKey = colourKey === "Colour" ? "Color" : "Colour";
          const { colour, size } = parseSkuColourAndSizeFromLabel(variantLabel);
          aspects[colourKey] = [colour];
          aspects.Size = [size];
          delete aspects[alternateColourKey];
        }
        if (gtin?.trim()) {
          aspects.GTIN = [gtin.trim()];
        }

        applyNuclearColourSizeFallback(
          aspects,
          getAspectVariantSources(aspectOptions),
          marketplaceId,
        );
      }

      console.log("Final aspects being sent to eBay:", JSON.stringify(aspects, null, 2));

      const body = {
        product: {
          title: listing.seoTitle,
          description: resolveEbayDescription(listing.descriptionHtml),
          imageUrls: normalizeImageUrls(imageUrls),
          aspects,
        },
        condition: mapCondition(listing.condition),
        availability: {
          shipToLocationAvailability: {
            quantity,
          },
        },
      };

      const { response, bodyText } = await ebayFetch("inventory_item PUT", requestUrl, {
        method: "PUT",
        headers: inventoryHeaders(token, marketplaceId),
        body: JSON.stringify(body),
        cache: "no-store",
      });

      return { url: requestUrl, response, bodyText };
    },
    "Failed to create eBay inventory item.",
    "inventory_item PUT",
  );
}

async function upsertInventoryItemGroup(
  token: string,
  marketplaceId: EbayMarketplaceId,
  groupKey: string,
  listing: GeneratedListing,
  imageUrls: string[],
  variantSkus: string[],
  _variantLabels: string[],
  aspectOptions: EbayAspectBuildOptions,
): Promise<void> {
  const requestUrl = `${EBAY_API_BASE}/sell/inventory/v1/inventory_item_group/${encodeURIComponent(groupKey)}`;

  await executeWithMissingAspectRetry(
    aspectOptions,
    async () => {
      const groupBody = buildInventoryItemGroupBody(
        groupKey,
        listing,
        imageUrls,
        variantSkus,
        aspectOptions,
        marketplaceId,
      );

      ensureGroupBodyHasAspects(groupBody, aspectOptions, marketplaceId);

      console.log("=== GROUP BODY BEING SENT ===");
      console.log(JSON.stringify(groupBody, null, 2));
      console.log("=== GROUP ASPECTS ===");
      console.log("Colour:", groupBody.aspects?.Colour);
      console.log("Size:", groupBody.aspects?.Size);

      const { response, bodyText } = await ebayFetch("inventory_item_group PUT", requestUrl, {
        method: "PUT",
        headers: inventoryHeaders(token, marketplaceId),
        body: JSON.stringify(groupBody),
        cache: "no-store",
      });

      return { url: requestUrl, response, bodyText };
    },
    "Failed to create eBay inventory item group.",
    "inventory_item_group PUT",
  );
}

function parseOfferIdFromErrorBody(bodyText: string): string | null {
  try {
    const data = JSON.parse(bodyText) as {
      errors?: Array<{
        errorId?: number;
        message?: string;
        parameters?: Array<{ name?: string; value?: string }>;
      }>;
    };

    for (const error of data.errors ?? []) {
      const isDuplicate =
        error.errorId === 25002 || error.message?.toLowerCase().includes("already exists");
      if (!isDuplicate) continue;

      const offerParam = error.parameters?.find((param) => param.name === "offerId");
      if (offerParam?.value) return offerParam.value;
    }
  } catch {
    return null;
  }

  return null;
}

function buildOfferBody(
  listing: GeneratedListing,
  categoryId: string,
  quantity: number,
  promotions: VolumePromotionTier[],
  policyIds: EbayBusinessPolicies,
  marketplaceId: EbayMarketplaceId,
  options: {
    sku?: string;
    inventoryItemGroupKey?: string;
    priceOverride?: number;
    merchantLocationKey: string;
  },
): Record<string, unknown> {
  const config = resolveMarketplaceConfig(marketplaceId);
  const { fulfillmentPolicyId, paymentPolicyId, returnPolicyId } = policyIds;

  if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
    throw new Error(
      "Shipping, payment, and return policies are required before listing on eBay.",
    );
  }

  const volumePricing = buildVolumePricing(promotions);
  const priceValue = options.priceOverride ?? listing.suggestedPrice;
  const pricingSummary: Record<string, unknown> = {
    price: {
      value: priceValue.toFixed(2),
      currency: listing.currency || config.currency,
    },
  };

  if (volumePricing.length > 0) {
    pricingSummary.volumePricing = volumePricing;
  }

  const body: Record<string, unknown> = {
    marketplaceId: config.marketplaceId,
    format: "FIXED_PRICE",
    listingDescription: resolveEbayDescription(listing.descriptionHtml),
    availableQuantity: quantity,
    categoryId,
    merchantLocationKey: options.merchantLocationKey,
    listingPolicies: {
      fulfillmentPolicyId,
      paymentPolicyId,
      returnPolicyId,
    },
    pricingSummary,
  };

  if (options.inventoryItemGroupKey) {
    body.inventoryItemGroupKey = options.inventoryItemGroupKey;
  }
  if (options.sku) {
    body.sku = options.sku;
  }

  return body;
}

async function updateOffer(
  token: string,
  marketplaceId: EbayMarketplaceId,
  offerId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const requestUrl = `${EBAY_API_BASE}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`;
  const { response, bodyText } = await ebayFetch("offer PUT", requestUrl, {
    method: "PUT",
    headers: inventoryHeaders(token, marketplaceId),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throwEbayApiError(requestUrl, response, bodyText, "Failed to update eBay offer.");
  }
}

async function createOffer(
  token: string,
  listing: GeneratedListing,
  categoryId: string,
  quantity: number,
  promotions: VolumePromotionTier[],
  policyIds: EbayBusinessPolicies,
  marketplaceId: EbayMarketplaceId,
  options: {
    sku?: string;
    inventoryItemGroupKey?: string;
    priceOverride?: number;
    merchantLocationKey: string;
  },
): Promise<string> {
  const body = buildOfferBody(
    listing,
    categoryId,
    quantity,
    promotions,
    policyIds,
    marketplaceId,
    options,
  );

  const requestUrl = `${EBAY_API_BASE}/sell/inventory/v1/offer`;
  const { response, bodyText } = await ebayFetch("offer POST", requestUrl, {
    method: "POST",
    headers: inventoryHeaders(token, marketplaceId),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (response.ok) {
    const data = parseJsonSafe(bodyText, {} as { offerId?: string });
    if (data.offerId) return data.offerId;
  }

  const offerIdFromError = parseOfferIdFromErrorBody(bodyText);
  if (offerIdFromError) {
    await updateOffer(token, marketplaceId, offerIdFromError, body);
    return offerIdFromError;
  }

  throwEbayApiError(requestUrl, response, bodyText, "Failed to create eBay offer.");
}

async function publishOfferByGroup(
  token: string,
  groupKey: string,
  marketplaceId: EbayMarketplaceId,
  aspectOptions: EbayAspectBuildOptions,
  reupsertInventory: () => Promise<void>,
): Promise<{ listingId: string | null }> {
  const config = resolveMarketplaceConfig(marketplaceId);
  const requestUrl = `${EBAY_API_BASE}/sell/inventory/v1/offer/publish_by_inventory_item_group`;

  return executePublishWithAspectRetry(
    aspectOptions,
    reupsertInventory,
    () =>
      ebayFetch("publish_by_group POST", requestUrl, {
        method: "POST",
        headers: inventoryHeaders(token, marketplaceId),
        body: JSON.stringify({
          inventoryItemGroupKey: groupKey,
          marketplaceId: config.marketplaceId,
        }),
        cache: "no-store",
      }).then(({ response, bodyText }) => ({ url: requestUrl, response, bodyText })),
    "Failed to publish eBay listing group.",
    "publish_by_group",
  );
}

async function publishOffer(
  token: string,
  marketplaceId: EbayMarketplaceId,
  offerId: string,
  aspectOptions: EbayAspectBuildOptions,
  reupsertInventory: () => Promise<void>,
): Promise<{ listingId: string | null }> {
  const requestUrl = `${EBAY_API_BASE}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`;

  return executePublishWithAspectRetry(
    aspectOptions,
    reupsertInventory,
    () =>
      ebayFetch("publish POST", requestUrl, {
        method: "POST",
        headers: inventoryHeaders(token, marketplaceId),
        cache: "no-store",
      }).then(({ response, bodyText }) => ({ url: requestUrl, response, bodyText })),
    "Failed to publish eBay listing.",
    "publish",
  );
}

export async function listDraftOnEbay(userId: string, draft: ListingDraft): Promise<ListOnEbayResult> {
  const token = await getEbayUserAccessToken(userId);
  if (!token) {
    throw new Error("eBay account is not connected. Connect your eBay account first.");
  }

  const marketplaceId = await getSellerMarketplaceId(userId);
  const marketplaceConfig = resolveMarketplaceConfig(marketplaceId);
  const sellerLocation = await requireConfirmedLocation(userId);
  const merchantLocationKey = sellerLocation.merchantLocationKey;

  if (draft.listing.brand !== "Unbranded") {
    throw new Error("Brand must remain Unbranded for this listing.");
  }

  const selectedPhotos = draft.photos.filter((photo) => photo.selected).map((photo) => photo.url);
  if (selectedPhotos.length === 0) {
    throw new Error("Select at least one photo for the listing.");
  }

  if (
    !draft.ebayPolicies?.fulfillmentPolicyId ||
    !draft.ebayPolicies?.paymentPolicyId ||
    !draft.ebayPolicies?.returnPolicyId
  ) {
    throw new Error("Shipping, payment, and return policies are required before listing on eBay.");
  }

  const policyIds = draft.ebayPolicies;
  const categoryId = await resolveCategoryId(token, draft.listing, marketplaceId);
  const categoryAspectNames = await getItemAspectsForCategory(token, categoryId, marketplaceId);
  const { colors, sizes } = extractColoursAndSizesFromLabels(
    draft.variants.map((variant) => variant.label),
  );
  const aspectOptions: EbayAspectBuildOptions = {
    marketplaceId,
    product: draft.product,
    variantDrafts: draft.variants,
    categoryAspectNames,
    aspectOverrides: {},
    extractedAspects: { colours: colors, sizes },
  };
  const selectedDescriptionPhotos = getSelectedDescriptionPhotos(draft.descriptionPhotos);
  const appOrigin = selectedDescriptionPhotos.length > 0 ? getAppOrigin() : "";
  const listing = {
    ...draft.listing,
    categoryId,
    currency: draft.listing.currency || marketplaceConfig.currency,
    brand: "Unbranded" as const,
    descriptionHtml: buildDescriptionHtmlWithImages(
      draft.listing.descriptionHtml,
      draft.descriptionPhotos,
      appOrigin,
    ),
  };

  console.log(
    "Variant labels for aspects:",
    draft.variants.map((variant) => variant.label),
  );
  console.log(
    "Preview aspects:",
    JSON.stringify(buildEbayAspects(listing, aspectOptions), null, 2),
  );

  const activeVariants = draft.variants.length > 0 ? draft.variants : [];
  const isMultiVariant = activeVariants.length > 1;
  assertUniqueVariantSkus(activeVariants);

  if (!isMultiVariant) {
    const variant = activeVariants[0];
    const sku = variant
      ? resolveVariantSkuForEbay(variant)
      : resolveVariantSkuForEbay({
          id: "default",
          label: "Default",
          imageUrl: "",
          price: listing.suggestedPrice,
          stock: 1,
          sku: draft.product.internalProductSku ?? "",
          ean: "",
          quantity: 1,
        });
    const images = variant?.imageUrl ? [variant.imageUrl, ...selectedPhotos] : selectedPhotos;
    const quantity = variant ? resolveVariantQuantity(variant) : 1;

    if (variant && variant.price > 0) {
      listing.suggestedPrice = variant.price;
    }

    await upsertInventoryItem(
      token,
      marketplaceId,
      sku,
      listing,
      images,
      quantity,
      aspectOptions,
      variant?.label,
      variant?.ean,
    );
    const offerId = await createOffer(
      token,
      listing,
      categoryId,
      quantity,
      draft.promotions,
      policyIds,
      marketplaceId,
      { sku, merchantLocationKey },
    );
    await requireConfirmedLocation(userId);
    const reupsertSingleInventory = async () => {
      await upsertInventoryItem(
        token,
        marketplaceId,
        sku,
        listing,
        images,
        quantity,
        aspectOptions,
        variant?.label,
        variant?.ean,
      );
    };
    const published = await publishOffer(
      token,
      marketplaceId,
      offerId,
      aspectOptions,
      reupsertSingleInventory,
    );

    return {
      sku,
      offerId,
      listingId: published.listingId,
      listingUrl: published.listingId
        ? buildEbayListingUrl(published.listingId, marketplaceId)
        : null,
    };
  }

  const groupKey = resolveGroupSkuKey(draft);
  const groupVariants = dedupeVariantsByCombo(activeVariants);

  if (groupVariants.length < activeVariants.length) {
    console.log(
      "[eBay group] Removed duplicate Colour+Size combos:",
      activeVariants.length - groupVariants.length,
    );
  }

  const { colors: groupColors, sizes: groupSizes } = extractColoursAndSizesFromLabels(
    groupVariants.map((variant) => variant.label),
  );
  aspectOptions.variantDrafts = groupVariants;
  aspectOptions.extractedAspects = { colours: groupColors, sizes: groupSizes };

  const variantResults = await Promise.all(
    groupVariants.map(async (variant) => {
      const sku = resolveVariantSkuForEbay(variant);

      const images = variant.imageUrl ? [variant.imageUrl, ...selectedPhotos] : selectedPhotos;
      const variantListing = { ...listing, suggestedPrice: variant.price };
      const quantity = resolveVariantQuantity(variant);

      await upsertInventoryItem(
        token,
        marketplaceId,
        sku,
        variantListing,
        images,
        quantity,
        aspectOptions,
        variant.label,
        variant.ean,
      );

      const offerId = await createOffer(
        token,
        listing,
        categoryId,
        quantity,
        draft.promotions,
        policyIds,
        marketplaceId,
        {
          sku,
          inventoryItemGroupKey: groupKey,
          priceOverride: variant.price,
          merchantLocationKey,
        },
      );

      return { sku, offerId, label: variant.label };
    }),
  );

  const variantSkus = variantResults.map((entry) => entry.sku);
  const variantLabels = variantResults.map((entry) => entry.label);
  const firstOfferId = variantResults[0]?.offerId ?? "";

  await upsertInventoryItemGroup(
    token,
    marketplaceId,
    groupKey,
    listing,
    selectedPhotos,
    variantSkus,
    variantLabels,
    aspectOptions,
  );

  await requireConfirmedLocation(userId);
  const reupsertAllInventory = async () => {
    await Promise.all(
      groupVariants.map(async (variant) => {
        const sku = resolveVariantSkuForEbay(variant);
        const images = variant.imageUrl ? [variant.imageUrl, ...selectedPhotos] : selectedPhotos;
        const variantListing = { ...listing, suggestedPrice: variant.price };
        const quantity = resolveVariantQuantity(variant);

        await upsertInventoryItem(
          token,
          marketplaceId,
          sku,
          variantListing,
          images,
          quantity,
          aspectOptions,
          variant.label,
          variant.ean,
        );
      }),
    );
    await upsertInventoryItemGroup(
      token,
      marketplaceId,
      groupKey,
      listing,
      selectedPhotos,
      variantSkus,
      variantLabels,
      aspectOptions,
    );
  };
  const published = await publishOfferByGroup(
    token,
    groupKey,
    marketplaceId,
    aspectOptions,
    reupsertAllInventory,
  );

  return {
    sku: groupKey,
    offerId: firstOfferId,
    listingId: published.listingId,
    listingUrl: published.listingId
      ? buildEbayListingUrl(published.listingId, marketplaceId)
      : null,
  };
}

// Backward-compatible helper
export async function listProductOnEbay(
  userId: string,
  listing: GeneratedListing,
  product: ListingDraft["product"],
  quantity = 1,
): Promise<ListOnEbayResult> {
  const baseSku = product.internalProductSku?.trim();
  if (!baseSku) {
    throw new Error("Internal product SKU is missing. Assign internal SKUs before listing.");
  }

  const draft: ListingDraft = {
    product,
    listing: { ...listing, brand: "Unbranded" },
    photos: (product.images.length > 0 ? product.images : product.imageUrl ? [product.imageUrl] : []).map(
      (url) => ({ url, selected: true }),
    ),
    variants: [
      {
        id: "default",
        label: "Default",
        imageUrl: product.imageUrl ?? product.images[0] ?? "",
        price: listing.suggestedPrice,
        stock: quantity,
        sku: baseSku,
        ean: "",
        quantity,
      },
    ],
    promotions: DEFAULT_PROMOTIONS.map((tier) => ({ ...tier })),
  };

  return listDraftOnEbay(userId, draft);
}
