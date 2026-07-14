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
  enforceSingleValueEbayAspects,
  extractColoursAndSizesFromLabels,
  filterAspectsForCategory,
  getSafeAspectDefault,
  mergeEbayAspects,
  normalizeAspectNameForMarketplace,
  resolveRequiredEbayAspects,
} from "@/lib/listings/item-specifics";
import { ensureDraftVariantEans, isValidGtin } from "@/lib/listings/ensure-draft-variant-eans";
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
const EBAY_FETCH_TIMEOUT_MS = 30000;

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EBAY_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const bodyText = await response.text();

    console.log(`[eBay ${label}] Status:`, response.status);
    console.log(`[eBay ${label}] Body:`, bodyText);

    return { response, bodyText };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`[eBay ${label}] Request timed out after ${EBAY_FETCH_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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

    const isValueConflict =
      combined.includes("should contain only one value") ||
      combined.includes("remove the extra value") ||
      combined.includes("duplicate");
    if (isValueConflict) return null;

    const isMissingAspect =
      combined.includes("missing required") ||
      (combined.includes("missing") && combined.includes("specific")) ||
      (combined.includes("item specific") && combined.includes("missing"));

    if (!isMissingAspect) return null;

    const paramField = first.parameters?.find((param) => param.name === "2")?.value?.trim();
    if (paramField) return paramField;

    const messageMatch = messageText.match(/item specifics?\s+(.+?)\s+is missing/i);
    if (messageMatch?.[1]?.trim()) {
      return messageMatch[1].trim();
    }

    const requiredMatch = messageText.match(/missing required field[:\s]+([A-Za-z /]+)/i);
    if (requiredMatch?.[1]?.trim()) {
      return requiredMatch[1].trim();
    }

    return null;
  } catch {
    return null;
  }
}

export function extractAspectConflictField(bodyText: string): string | null {
  try {
    const data = JSON.parse(bodyText) as {
      errors?: Array<{
        message?: string;
        longMessage?: string;
        parameters?: Array<{ name?: string; value?: string }>;
      }>;
    };
    const first = data.errors?.[0];
    if (!first) return null;

    const combined = `${first.message ?? ""} ${first.longMessage ?? ""}`.toLowerCase();
    const isConflict =
      combined.includes("should contain only one value") ||
      combined.includes("remove the extra value") ||
      combined.includes("duplicate");
    if (!isConflict) return null;

    const paramField = first.parameters?.find((param) => param.name === "2")?.value?.trim();
    return paramField ?? null;
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

  const fieldLower = fieldKey.toLowerCase();
  if ((fieldLower === "ean" || fieldLower === "gtin") && !isMultiSkuListing(aspectOptions)) {
    const variantEan = aspectOptions.variantDrafts
      ?.map((variant) => variant.ean?.trim())
      .find((value) => isValidGtin(value));
    if (variantEan) {
      aspectOptions.aspectOverrides[fieldKey] = [variantEan];
      console.log(`Auto-retry ${attempt}: fixing ${fieldKey} from variant`, variantEan);
      return;
    }
  }

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

    const conflictField = extractAspectConflictField(bodyText);
    if (conflictField) {
      if (attempts < MAX_ASPECT_RETRIES) {
        patchAspectConflictToSingleValue(aspectOptions, conflictField, attempts + 1);
        attempts++;
        continue;
      }
      console.log(
        `[eBay ${label}] Value conflict on "${conflictField}" - stopping retries (would inject more data).`,
      );
    }

    throwEbayApiError(url, response, bodyText, fallbackMessage);
  }
}

function patchAspectConflictToSingleValue(
  aspectOptions: EbayAspectBuildOptions,
  conflictField: string,
  attempt: number,
): void {
  if (!aspectOptions.aspectOverrides) {
    aspectOptions.aspectOverrides = {};
  }
  const fieldKey =
    aspectOptions.marketplaceId === "EBAY_GB"
      ? normalizeAspectNameForMarketplace(conflictField, aspectOptions.marketplaceId)
      : conflictField;
  aspectOptions.aspectOverrides[fieldKey] = [getSafeAspectDefault(fieldKey)[0]];
  console.log(`Auto-retry ${attempt}: reducing ${fieldKey} to a single value`);
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

    if (attempts < MAX_ASPECT_RETRIES && isAvailabilityPropagationError(bodyText)) {
      console.log(
        `[eBay ${label}] Availability not found (25604) - re-upserting inventory and retrying after delay`,
      );
      await reupsertInventory();
      await sleep(2000 * (attempts + 1));
      attempts++;
      continue;
    }

    const conflictField = extractAspectConflictField(bodyText);
    if (conflictField) {
      if (attempts < MAX_ASPECT_RETRIES) {
        console.log(
          `[eBay ${label}] Value conflict on "${conflictField}", re-upserting with single value and retrying`,
        );
        patchAspectConflictToSingleValue(aspectOptions, conflictField, attempts + 1);
        await reupsertInventory();
        attempts++;
        continue;
      }
      console.log(
        `[eBay ${label}] Value conflict on "${conflictField}" - stopping retries (would inject more data).`,
      );
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// eBay sometimes returns 25604 "Availability not found" when publishing a group
// immediately after creating its inventory items, because availability has not
// finished propagating on their side. This is transient and resolved by a retry.
function isAvailabilityPropagationError(bodyText: string): boolean {
  const data = parseJsonSafe(bodyText, {} as {
    errors?: Array<{ errorId?: number; message?: string }>;
  });
  return (data.errors ?? []).some(
    (error) =>
      error.errorId === 25604 ||
      (error.message?.toLowerCase().includes("availability not found") ?? false),
  );
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

const EBAY_DESCRIPTION_MAX_LENGTH = 4000;

const EBAY_DESCRIPTION_FALLBACK = "Please see product images for details.";

const EBAY_DESCRIPTION_EMPTY_FALLBACK =
  "Quality product. Please see images for full details. Contact us with any questions.";

// Force any insecure or protocol-relative image/link URL to https so eBay accepts
// it (eBay rejects mixed/insecure content in descriptions).
function secureDescriptionUrls(html: string): string {
  return html
    .replace(/(\s(?:src|href)\s*=\s*")\/\//gi, "$1https://")
    .replace(/(\s(?:src|href)\s*=\s*")http:\/\//gi, "$1https://");
}

// eBay descriptions support HTML but not active content. Preserve formatting and
// <img> tags; only strip script/style/iframe blocks and inline event handlers.
function cleanDescription(html: string): string {
  let cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "");

  cleaned = secureDescriptionUrls(cleaned);

  // Collapse excessive blank lines/spaces without destroying tags.
  cleaned = cleaned.replace(/[ \t]+/g, " ").replace(/(\s*\n\s*){3,}/g, "\n\n").trim();

  return cleaned;
}

// eBay limits product.description to 4000 chars (error 25718). The images are
// appended as a trailing <div> of <img> tags, so when we must truncate we keep
// that image block intact and trim only the preceding text - otherwise the
// images we fixed would get cut off again.
function enforceEbayDescriptionLimit(html: string): string {
  if (html.length <= EBAY_DESCRIPTION_MAX_LENGTH) {
    return html;
  }

  const imageBlockMatch = html.match(/\s*<div[^>]*>\s*((?:<img\b[^>]*>\s*)+)<\/div>\s*$/i);
  if (imageBlockMatch) {
    const fullImageBlock = imageBlockMatch[0];
    const imageTags = [...imageBlockMatch[1].matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
    const divOpen = fullImageBlock.match(/^(\s*<div[^>]*>\s*)/i)?.[1] ?? '<div style="margin-top:20px">\n';
    const divClose = "\n</div>";
    const textPart = html.slice(0, html.length - fullImageBlock.length);

    const room = EBAY_DESCRIPTION_MAX_LENGTH - fullImageBlock.length - 3;
    if (room > 0) {
      let trimmedText = textPart.slice(0, room);
      const lastTagClose = trimmedText.lastIndexOf(">");
      if (lastTagClose > 0) {
        trimmedText = trimmedText.slice(0, lastTagClose + 1);
      }
      return `${trimmedText}...${fullImageBlock}`;
    }

    const fallbackText = "<p>See product images below.</p>";
    let budget = EBAY_DESCRIPTION_MAX_LENGTH - fallbackText.length - divOpen.length - divClose.length;
    const keptImages: string[] = [];
    for (const tag of imageTags) {
      const nextLength = keptImages.join("\n").length + (keptImages.length > 0 ? 1 : 0) + tag.length;
      if (nextLength > budget) break;
      keptImages.push(tag);
    }

    if (keptImages.length > 0) {
      return `${fallbackText}${divOpen}${keptImages.join("\n")}${divClose}`;
    }
  }

  const truncated = html.substring(0, EBAY_DESCRIPTION_MAX_LENGTH - 3);
  const lastTagClose = truncated.lastIndexOf(">");
  const safe = lastTagClose > 0 ? truncated.substring(0, lastTagClose + 1) : truncated;
  return `${safe}...`;
}

function resolveEbayDescription(html: string | null | undefined): string {
  const raw = html?.trim();
  let description = raw ? cleanDescription(raw) : EBAY_DESCRIPTION_FALLBACK;

  if (!description || description.length === 0) {
    description = EBAY_DESCRIPTION_EMPTY_FALLBACK;
  }

  description = enforceEbayDescriptionLimit(description);

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

function labelsHaveExplicitSize(labels: string[]): boolean {
  return labels.some(
    (label) => label.split("/").map((part) => part.trim()).filter(Boolean).length > 1,
  );
}

function buildGroupVariesBy(
  colourKey: "Colour" | "Color",
  colours: string[],
  sizes: string[],
  aspectOptions: EbayAspectBuildOptions,
): {
  aspectsImageVariesBy: string[];
  specifications: Array<{ name: string; values: string[] }>;
} {
  const uniqueColours = dedupeVariationValues(colours);
  const uniqueSizes = dedupeVariationValues(sizes);
  const labels = (aspectOptions.variantDrafts ?? [])
    .map((variant) => variant.label?.trim() ?? "")
    .filter(Boolean);

  const specifications: Array<{ name: string; values: string[] }> = [];

  if (uniqueColours.length > 0) {
    specifications.push({ name: colourKey, values: uniqueColours });
  }

  const hasSizeVariants = labelsHaveExplicitSize(labels);

  if (hasSizeVariants && uniqueSizes.length > 0) {
    specifications.push({ name: "Size", values: uniqueSizes });
  }

  return {
    aspectsImageVariesBy: [colourKey],
    specifications,
  };
}

function isMultiSkuListing(aspectOptions: EbayAspectBuildOptions): boolean {
  return (aspectOptions.variantDrafts?.length ?? 0) > 1;
}

function buildMultiSkuInventoryItemAspects(
  aspects: Record<string, string[]>,
): Record<string, string[]> {
  // Variation dimensions (Colour/Size) must live only in the group's variesBy and
  // in each member's own single value - never in the shared/common aspects. Keep
  // all other item specifics (Type, Style, etc.) so required aspects are not dropped.
  const variationKeys = new Set(["colour", "color", "size"]);
  const filtered: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(aspects)) {
    if (variationKeys.has(key.toLowerCase())) continue;
    if (values.length === 0) continue;
    filtered[key] = values;
  }
  return filtered;
}

function applyNuclearColourSizeFallback(
  aspects: Record<string, string[]>,
  variants: AspectVariantSource[],
  marketplaceId: EbayMarketplaceId,
  isMultiSku = false,
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

  const colourMissing =
    !aspects[colourKey] ||
    aspects[colourKey].length === 0 ||
    aspects[colourKey][0] === undefined;

  if (colourMissing) {
    if (isMultiSku) {
      aspects[colourKey] = ["Multicolor"];
    } else {
      const colourFromVariants = variants
        .map((variant) =>
          String(variant.label ?? variant.name ?? "").split("/").map((part) => part.trim())[0],
        )
        .filter((colour) => colour && colour.length > 0 && colour !== "undefined");

      aspects[colourKey] =
        colourFromVariants.length > 0 ? [...new Set(colourFromVariants)] : ["Multicolor"];
    }
  }

  delete aspects[alternateColourKey];

  const sizeMissing = !aspects.Size || aspects.Size.length === 0;

  if (sizeMissing) {
    if (isMultiSku) {
      aspects.Size = ["One Size"];
    } else {
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
    }
  } else if (!isMultiSku && extractedSizes.length > 0 && aspects.Size.every((size) => !size?.trim())) {
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

  const hasSize = (aspectOptions.variantDrafts ?? []).some((variant) =>
    String(variant.label ?? "").includes("/"),
  );

  const specifications: Array<{ name: string; values: string[] }> = [
    { name: colourKey, values: finalColours },
  ];

  if (hasSize) {
    specifications.push({
      name: "Size",
      values: finalSizes,
    });
  }

  const variesBy = {
    aspectsImageVariesBy: [colourKey],
    specifications,
  };

  console.log("=== VARIES BY BEING SENT ===");
  console.log(JSON.stringify(variesBy, null, 2));
  console.log("=== END VARIES BY ===");

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

  const labels = (aspectOptions.variantDrafts ?? [])
    .map((v) => v.label?.trim() ?? "")
    .filter(Boolean);

  const hasSizeVariants = labels.some((l) => l.includes("/"));

  const specsForEnsure: Array<{ name: string; values: string[] }> = [];

  const colourValues = existingColourSpec?.length ? existingColourSpec : safeColours;
  specsForEnsure.push({
    name: colourKey,
    values: dedupeVariationValues(colourValues),
  });

  if (hasSizeVariants) {
    const sizeValues = existingSizeSpec?.length ? existingSizeSpec : safeSizes;
    specsForEnsure.push({
      name: "Size",
      values: dedupeVariationValues(sizeValues),
    });
  }

  groupBody.variesBy = {
    aspectsImageVariesBy: [colourKey],
    specifications: specsForEnsure,
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
    aspects = enforceSingleValueEbayAspects(aspects, marketplaceId);
    console.log("=== ASPECTS BEING SENT ===");
    console.log(JSON.stringify(aspects, null, 2));
    return aspects;
  }

  const defaults = resolveRequiredEbayAspects(context);
  const aiAspects = aspectsFromListingSpecifics(listing, marketplaceId);
  aspects = mergeEbayAspects(defaults, aiAspects, aspectOverrides);
  aspects = enforceProtectedEbayAspects(aspects, context);
  aspects = enforceSingleValueEbayAspects(aspects, marketplaceId);
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

async function getCategoryVariationSupport(
  token: string,
  categoryIds: string[],
  marketplaceId: EbayMarketplaceId,
): Promise<Map<string, boolean>> {
  const support = new Map<string, boolean>();
  const uniqueIds = [...new Set(categoryIds.map((id) => id.trim()).filter(Boolean))].slice(0, 50);
  if (uniqueIds.length === 0) return support;

  const url = new URL(
    `${EBAY_API_BASE}/sell/metadata/v1/marketplace/${marketplaceId}/get_listing_structure_policies`,
  );
  url.searchParams.set("filter", `categoryIds:{${uniqueIds.join("|")}}`);

  const { response, bodyText } = await ebayFetch("metadata/listing-structure", url.toString(), {
    headers: taxonomyHeaders(token, marketplaceId),
    cache: "no-store",
  });

  if (response.status === 204 || !response.ok) {
    return support;
  }

  const data = parseJsonSafe(bodyText, {} as {
    listingStructurePolicies?: Array<{
      categoryId?: string;
      category_id?: string;
      variationsSupported?: boolean;
      variations_supported?: boolean;
    }>;
  });

  for (const policy of data.listingStructurePolicies ?? []) {
    const categoryId = policy.categoryId ?? policy.category_id;
    const variationsSupported = policy.variationsSupported ?? policy.variations_supported;
    if (categoryId) {
      support.set(categoryId, Boolean(variationsSupported));
    }
  }

  return support;
}

async function categorySupportsVariationsViaAspects(
  token: string,
  categoryId: string,
  marketplaceId: EbayMarketplaceId,
): Promise<boolean> {
  const config = resolveMarketplaceConfig(marketplaceId);
  const url = new URL(
    `${EBAY_API_BASE}/commerce/taxonomy/v1/category_tree/${config.categoryTreeId}/get_item_aspects_for_category`,
  );
  url.searchParams.set("category_id", categoryId);

  const { response, bodyText } = await ebayFetch("taxonomy/aspect-variations", url.toString(), {
    headers: taxonomyHeaders(token, marketplaceId),
    cache: "no-store",
  });

  if (!response.ok) return false;

  const data = parseJsonSafe(bodyText, {} as {
    aspects?: Array<{
      aspectConstraint?: {
        aspectEnabledForVariations?: boolean;
      };
    }>;
  });

  return (data.aspects ?? []).some(
    (aspect) => aspect.aspectConstraint?.aspectEnabledForVariations === true,
  );
}

async function categorySupportsVariations(
  token: string,
  categoryId: string,
  marketplaceId: EbayMarketplaceId,
  supportCache?: Map<string, boolean>,
): Promise<boolean> {
  const cached = supportCache?.get(categoryId);
  if (cached !== undefined) return cached;

  let supported = false;
  const metadataSupport = await getCategoryVariationSupport(token, [categoryId], marketplaceId);
  const fromMetadata = metadataSupport.get(categoryId);
  if (fromMetadata !== undefined) {
    supported = fromMetadata;
  } else {
    supported = await categorySupportsVariationsViaAspects(token, categoryId, marketplaceId);
  }

  supportCache?.set(categoryId, supported);
  return supported;
}

async function resolveCategoryId(
  token: string,
  listing: GeneratedListing,
  marketplaceId: EbayMarketplaceId,
  options?: { requireVariations?: boolean },
): Promise<string> {
  const requireVariations = options?.requireVariations ?? false;

  if (!requireVariations) {
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

  const suggestions = await getCategorySuggestions(
    token,
    listing.categorySuggestion || listing.seoTitle,
    marketplaceId,
  );

  const candidateIds: string[] = [];
  if (listing.categoryId?.trim()) {
    candidateIds.push(listing.categoryId.trim());
  }
  for (const suggestion of suggestions) {
    if (suggestion.categoryId && !candidateIds.includes(suggestion.categoryId)) {
      candidateIds.push(suggestion.categoryId);
    }
  }

  if (candidateIds.length === 0) {
    throw new Error("Could not resolve an eBay category for this product.");
  }

  const supportCache = await getCategoryVariationSupport(token, candidateIds, marketplaceId);

  for (const categoryId of candidateIds) {
    const supported = await categorySupportsVariations(
      token,
      categoryId,
      marketplaceId,
      supportCache,
    );
    if (supported) {
      if (listing.categoryId && listing.categoryId !== categoryId) {
        console.log(
          `[eBay category] Using ${categoryId} instead of ${listing.categoryId} because variations are required.`,
        );
      }
      return categoryId;
    }
  }

  throw new Error(
    "The selected eBay category does not support multi-variation listings. Edit the category on the review page and choose one that supports variations.",
  );
}

// eBay accepts GTINs of 8, 12, 13, or 14 digits. Anything else is rejected,
// so we only forward a GTIN when it matches one of those formats.
function applyGtinAspects(aspects: Record<string, string[]>, gtin?: string): void {
  if (!isValidGtin(gtin)) {
    if (gtin?.trim()) {
      console.log(`[eBay inventory_item PUT] Skipping invalid GTIN: ${gtin.trim()}`);
    }
    return;
  }

  const value = gtin!.trim();
  aspects.GTIN = [value];
  aspects.EAN = [value];
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
        // Each member SKU in a group MUST carry its own variation values so eBay
        // can place it uniquely in the matrix. Keep the shared aspects, then add
        // this SKU's single Colour (+ Size when the group varies by size). Without
        // it every member looks identical -> 25013 "Duplicate name-value combination".
        const memberAspects = buildMultiSkuInventoryItemAspects(aspects);
        const colourKey = marketplaceId === "EBAY_GB" ? "Colour" : "Color";
        const alternateColourKey = colourKey === "Colour" ? "Color" : "Colour";
        const { colour, size } = parseSkuColourAndSizeFromLabel(variantLabel ?? "");
        memberAspects[colourKey] = [colour];
        delete memberAspects[alternateColourKey];

        const groupHasSize = (aspectOptions.variantDrafts ?? []).some((variant) =>
          String(variant.label ?? "").includes("/"),
        );
        if (groupHasSize) {
          memberAspects.Size = [size];
        }
        applyGtinAspects(memberAspects, gtin);
        aspects = memberAspects;
      } else {
        if (variantLabel) {
          const colourKey = marketplaceId === "EBAY_GB" ? "Colour" : "Color";
          const alternateColourKey = colourKey === "Colour" ? "Color" : "Colour";
          const { colour, size } = parseSkuColourAndSizeFromLabel(variantLabel);
          aspects[colourKey] = [colour];
          aspects.Size = [size];
          delete aspects[alternateColourKey];
        }
        applyGtinAspects(aspects, gtin);

        applyNuclearColourSizeFallback(
          aspects,
          getAspectVariantSources(aspectOptions),
          marketplaceId,
          isMultiSkuListing(aspectOptions),
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

      const variationSpecifics = groupBody.variesBy?.specifications ?? [];
      const uniqueSpecifics: typeof variationSpecifics = [];
      const seen = new Set<string>();
      for (const item of variationSpecifics) {
        if (!seen.has(item.name)) {
          uniqueSpecifics.push(item);
          seen.add(item.name);
        }
      }
      if (groupBody.variesBy) {
        groupBody.variesBy.specifications = uniqueSpecifics;
      }

      console.log("FINAL PAYLOAD TO EBAY:", JSON.stringify(uniqueSpecifics, null, 2));

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

function resolveAliVariantMeta(
  variant: ListingDraft["variants"][number],
  product: ListingDraft["product"],
): { aliPrice: number; aliStock: number | null } {
  const source = product.variants?.find((entry) => entry.id === variant.id);
  return {
    aliPrice: variant.aliExpressPrice ?? source?.price ?? product.price,
    aliStock: source?.stock ?? product.stock,
  };
}

function buildListedVariantResults(
  variants: ListingDraft["variants"],
  offers: Array<{ sku: string; offerId: string; label: string }>,
  product: ListingDraft["product"],
  fallbackPrice = 0,
): NonNullable<ListOnEbayResult["variants"]> {
  return variants.map((variant, index) => {
    const offer = offers[index] ?? offers.find((entry) => entry.label === variant.label) ?? offers[0];
    const aliMeta = resolveAliVariantMeta(variant, product);
    return {
      sku: offer?.sku ?? variant.sku,
      offerId: offer?.offerId ?? "",
      label: variant.label,
      price: variant.price > 0 ? variant.price : fallbackPrice,
      quantity: resolveVariantQuantity(variant),
      aliVariantId: variant.id,
      aliPrice: aliMeta.aliPrice,
      aliStock: aliMeta.aliStock,
    };
  });
}

export async function listDraftOnEbay(userId: string, draft: ListingDraft): Promise<ListOnEbayResult> {
  draft = await ensureDraftVariantEans(draft);

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

  const activeVariants = draft.variants.length > 0 ? draft.variants : [];
  assertUniqueVariantSkus(activeVariants);
  const dedupedVariants =
    activeVariants.length > 1 ? dedupeVariantsByCombo(activeVariants) : activeVariants;
  const isMultiVariant = dedupedVariants.length > 1;

  const categoryId = await resolveCategoryId(token, draft.listing, marketplaceId, {
    requireVariations: isMultiVariant,
  });
  const categoryAspectNames = await getItemAspectsForCategory(token, categoryId, marketplaceId);
  const { colors, sizes } = extractColoursAndSizesFromLabels(
    dedupedVariants.map((variant) => variant.label),
  );
  const aspectOptions: EbayAspectBuildOptions = {
    marketplaceId,
    product: draft.product,
    variantDrafts: dedupedVariants,
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
    dedupedVariants.map((variant) => variant.label),
  );
  console.log(
    "Preview aspects:",
    JSON.stringify(buildEbayAspects(listing, aspectOptions), null, 2),
  );

  if (dedupedVariants.length < activeVariants.length) {
    console.log(
      "[eBay group] Removed duplicate Colour+Size combos:",
      activeVariants.length - dedupedVariants.length,
    );
  }

  if (!isMultiVariant) {
    const variant = dedupedVariants[0];
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
      variants: buildListedVariantResults(
        variant ? [variant] : dedupedVariants,
        [{ sku, offerId, label: variant?.label ?? "Default" }],
        draft.product,
        listing.suggestedPrice,
      ),
    };
  }

  const groupKey = resolveGroupSkuKey(draft);
  const groupVariants = dedupedVariants;

  const variantResults = await Promise.all(
    groupVariants.map(async (variant) => {
      const variantAspectOptions = structuredClone(aspectOptions);
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
        variantAspectOptions,
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
        const variantAspectOptions = structuredClone(aspectOptions);
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
          variantAspectOptions,
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
    variants: buildListedVariantResults(
      groupVariants,
      variantResults.map((entry) => ({ sku: entry.sku, offerId: entry.offerId, label: entry.label })),
      draft.product,
      listing.suggestedPrice,
    ),
  };
}

export async function reviseEbayListedVariant(
  userId: string,
  draft: ListingDraft,
  variant: {
    sku: string;
    offerId: string;
    price: number;
    quantity: number;
    label: string;
    ean?: string;
  },
): Promise<void> {
  const token = await getEbayUserAccessToken(userId);
  if (!token) {
    throw new Error("eBay account is not connected or token expired. Reconnect eBay.");
  }

  const marketplaceId = await getSellerMarketplaceId(userId);
  const sellerLocation = await requireConfirmedLocation(userId);
  const categoryId = draft.listing.categoryId;
  if (!categoryId) {
    throw new Error("Missing eBay category on saved listing.");
  }
  if (!draft.ebayPolicies) {
    throw new Error("Missing eBay policies on saved listing.");
  }

  const listing = { ...draft.listing, suggestedPrice: variant.price };
  const body = buildOfferBody(
    listing,
    categoryId,
    variant.quantity,
    draft.promotions,
    draft.ebayPolicies,
    marketplaceId,
    {
      sku: variant.sku,
      priceOverride: variant.price,
      merchantLocationKey: sellerLocation.merchantLocationKey,
    },
  );

  await updateOffer(token, marketplaceId, variant.offerId, body);
}

export async function reviseEbayListedProduct(
  userId: string,
  draft: ListingDraft,
  offersBySku: Record<string, string>,
  groupSku?: string | null,
): Promise<void> {
  draft = await ensureDraftVariantEans(draft);

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
    throw new Error("Shipping, payment, and return policies are required before updating on eBay.");
  }

  const policyIds = draft.ebayPolicies;

  const activeVariants = draft.variants.length > 0 ? draft.variants : [];
  assertUniqueVariantSkus(activeVariants);
  const dedupedVariants =
    activeVariants.length > 1 ? dedupeVariantsByCombo(activeVariants) : activeVariants;
  const isMultiVariant = dedupedVariants.length > 1;

  const categoryId = await resolveCategoryId(token, draft.listing, marketplaceId, {
    requireVariations: isMultiVariant,
  });
  const categoryAspectNames = await getItemAspectsForCategory(token, categoryId, marketplaceId);
  const { colors, sizes } = extractColoursAndSizesFromLabels(
    dedupedVariants.map((variant) => variant.label),
  );
  const aspectOptions: EbayAspectBuildOptions = {
    marketplaceId,
    product: draft.product,
    variantDrafts: dedupedVariants,
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

  if (!isMultiVariant) {
    const variant = dedupedVariants[0];
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
    const offerId = offersBySku[sku];
    if (!offerId) {
      throw new Error("Missing eBay offer ID for this listing. Re-list from the tool to enable edits.");
    }

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

    const body = buildOfferBody(
      listing,
      categoryId,
      quantity,
      draft.promotions,
      policyIds,
      marketplaceId,
      {
        sku,
        priceOverride: variant?.price ?? listing.suggestedPrice,
        merchantLocationKey,
      },
    );
    await updateOffer(token, marketplaceId, offerId, body);
    return;
  }

  const groupKey = groupSku?.trim() || resolveGroupSkuKey(draft);
  const groupVariants = dedupedVariants;
  const variantSkus: string[] = [];
  const variantLabels: string[] = [];

  for (const variant of groupVariants) {
    const variantAspectOptions = structuredClone(aspectOptions);
    const sku = resolveVariantSkuForEbay(variant);
    const offerId = offersBySku[sku];
    if (!offerId) {
      throw new Error(`Missing eBay offer ID for variant ${variant.label}.`);
    }

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
      variantAspectOptions,
      variant.label,
      variant.ean,
    );

    const body = buildOfferBody(
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
    await updateOffer(token, marketplaceId, offerId, body);
    variantSkus.push(sku);
    variantLabels.push(variant.label);
  }

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
