import "server-only";

import { generateAiJson, generateAiVisionJson } from "@/lib/gemini/client";
import { buildVeroCheckPrompt } from "@/lib/gemini/prompts";
import {
  findBrandInText,
  findRestrictedWord,
  stripHtml,
} from "@/lib/listings/vero-brands";
import type {
  GeneratedListing,
  ListingDraft,
  ListingProductSource,
  VeroCheckResult,
} from "@/types/listing-generator";

interface AiVeroResponse {
  safe?: boolean;
  isCounterfeitOrBranded?: boolean;
  isBannedCategory?: boolean;
  hasRestrictedWords?: boolean;
  warnings?: string[];
  summary?: string;
}

interface ImageBrandScanResult {
  hasBrandLogo?: boolean;
  brandFound?: string | null;
  confidence?: "high" | "medium" | "low";
  reason?: string;
}

export interface VeroTextScanInput {
  title?: string;
  sourceTitle?: string;
  description?: string | null;
  descriptionHtml?: string;
  variantLabels?: string[];
  itemSpecifics?: Array<{ name: string; value: string }>;
  brand?: string;
  imageUrls?: string[];
}

const IMAGE_BRAND_PROMPT = `Look at these product images carefully.
Does any image show a brand logo, brand name, trademark, or recognizable branded design from companies like Nike, Adidas, Apple, Samsung, Louis Vuitton, or any other well-known brand?

Reply with JSON only:
{
  "hasBrandLogo": true or false,
  "brandFound": "brand name or null",
  "confidence": "high" or "medium" or "low",
  "reason": "brief explanation"
}`;

function brandedTextBlock(brand: string): VeroCheckResult {
  return {
    safe: false,
    isCounterfeitOrBranded: true,
    isBannedCategory: false,
    hasRestrictedWords: false,
    brandFound: brand,
    blockType: "branded_text",
    warnings: [`Brand detected in product content: ${brand}`],
    summary: `⛔ BRANDED PRODUCT DETECTED\nThis product contains ${brand} branding.\nListing this on eBay will violate VeRO policy and may result in account suspension.\nWe cannot proceed with this listing.`,
  };
}

function brandLogoBlock(brand: string, reason?: string): VeroCheckResult {
  const label = brand || "a well-known brand";
  return {
    safe: false,
    isCounterfeitOrBranded: true,
    isBannedCategory: false,
    hasRestrictedWords: false,
    brandFound: brand || null,
    blockType: "brand_logo_image",
    warnings: [reason ?? `Brand logo detected in product images: ${label}`],
    summary: `⛔ BRAND LOGO DETECTED IN IMAGES\nOur AI detected ${label} logo in your product images. This is a VeRO violation.\neBay will remove this listing and may suspend your account.\nWe cannot proceed with this listing.`,
  };
}

function restrictedWordBlock(word: string): VeroCheckResult {
  return {
    safe: false,
    isCounterfeitOrBranded: false,
    isBannedCategory: false,
    hasRestrictedWords: true,
    blockType: "restricted_words",
    warnings: [`Restricted word detected: ${word}`],
    summary: `⛔ RESTRICTED PRODUCT LANGUAGE DETECTED\nThis product contains restricted terms ("${word}") that indicate counterfeit or policy-violating goods.\nWe cannot proceed with this listing.`,
  };
}

function collectTextFields(input: VeroTextScanInput): string[] {
  const parts: string[] = [];

  if (input.title) parts.push(input.title);
  if (input.sourceTitle) parts.push(input.sourceTitle);
  if (input.description) parts.push(input.description);
  if (input.descriptionHtml) parts.push(stripHtml(input.descriptionHtml));
  if (input.brand) parts.push(input.brand);
  if (input.variantLabels?.length) parts.push(...input.variantLabels);
  if (input.itemSpecifics?.length) {
    for (const specific of input.itemSpecifics) {
      parts.push(specific.name, specific.value);
    }
  }
  if (input.imageUrls?.length) {
    parts.push(...input.imageUrls);
  }

  return parts.filter(Boolean);
}

export function scanTextForVeroViolations(input: VeroTextScanInput): VeroCheckResult | null {
  const combined = collectTextFields(input).join("\n");

  const brand = findBrandInText(combined);
  if (brand) return brandedTextBlock(brand);

  const restricted = findRestrictedWord(combined);
  if (restricted) return restrictedWordBlock(restricted);

  return null;
}

function collectProductImageUrls(product: ListingProductSource): string[] {
  const urls = new Set<string>();
  if (product.imageUrl) urls.add(product.imageUrl);
  for (const url of product.images) urls.add(url);
  for (const url of product.descriptionImages ?? []) urls.add(url);
  for (const variant of product.variants ?? []) {
    if (variant.imageUrl) urls.add(variant.imageUrl);
  }
  return [...urls].filter(Boolean).slice(0, 3);
}

async function scanImagesForBrandLogos(imageUrls: string[]): Promise<VeroCheckResult | null> {
  const urls = imageUrls.filter(Boolean).slice(0, 3);
  if (urls.length === 0) return null;

  try {
    const raw = await generateAiVisionJson<ImageBrandScanResult>(urls, IMAGE_BRAND_PROMPT);

    const hasLogo = Boolean(raw.hasBrandLogo);
    const confidence = raw.confidence ?? "low";
    const brandFound = raw.brandFound?.trim() || null;

    if (hasLogo && (confidence === "high" || confidence === "medium")) {
      return brandLogoBlock(brandFound ?? "a well-known brand", raw.reason);
    }
  } catch {
    // Vision unavailable — text checks still apply; do not block on API failure alone.
  }

  return null;
}

function productToTextInput(product: ListingProductSource, title?: string): VeroTextScanInput {
  return {
    title,
    sourceTitle: product.title,
    description: product.description,
    variantLabels: product.variants?.map((variant) => variant.label),
    imageUrls: collectProductImageUrls(product),
  };
}

export async function checkVeroSafety(
  product: ListingProductSource,
  title?: string,
): Promise<VeroCheckResult> {
  const textInput = productToTextInput(product, title);
  const textHit = scanTextForVeroViolations(textInput);
  if (textHit) return textHit;

  const imageHit = await scanImagesForBrandLogos(collectProductImageUrls(product));
  if (imageHit) return imageHit;

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

  if (!safe) {
    if (isCounterfeitOrBranded) {
      const brand = findBrandInText(warnings.join(" ")) ?? "a branded product";
      return brandedTextBlock(brand);
    }
    if (hasRestrictedWords) {
      const word = findRestrictedWord(warnings.join(" ")) ?? "restricted terms";
      return restrictedWordBlock(word);
    }
    return {
      safe: false,
      isCounterfeitOrBranded,
      isBannedCategory,
      hasRestrictedWords,
      warnings,
      blockType: isBannedCategory ? "banned_category" : undefined,
      summary:
        raw.summary?.trim() ||
        "Do not list — account may get banned. This product may violate eBay VeRO or category policies.",
    };
  }

  return {
    safe: true,
    isCounterfeitOrBranded: false,
    isBannedCategory: false,
    hasRestrictedWords: false,
    warnings,
    summary: raw.summary?.trim() || "Product appears safe to list on eBay UK.",
  };
}

function collectDraftImageUrls(draft: ListingDraft): string[] {
  const urls = new Set<string>();

  for (const photo of draft.photos) {
    if (photo.selected && photo.url) urls.add(photo.url);
  }
  for (const variant of draft.variants) {
    if (variant.imageUrl) urls.add(variant.imageUrl);
  }
  if (draft.product.imageUrl) urls.add(draft.product.imageUrl);
  for (const url of draft.product.images) urls.add(url);

  return [...urls].filter(Boolean).slice(0, 3);
}

export async function checkVeroSafetyForDraft(draft: ListingDraft): Promise<VeroCheckResult> {
  const listing: GeneratedListing = draft.listing;

  const textInput: VeroTextScanInput = {
    title: listing.seoTitle,
    sourceTitle: draft.product.title,
    description: draft.product.description,
    descriptionHtml: listing.descriptionHtml,
    brand: listing.brand,
    variantLabels: draft.variants.map((variant) => variant.label),
    itemSpecifics: listing.itemSpecifics,
    imageUrls: collectDraftImageUrls(draft),
  };

  const textHit = scanTextForVeroViolations(textInput);
  if (textHit) return textHit;

  const imageHit = await scanImagesForBrandLogos(collectDraftImageUrls(draft));
  if (imageHit) return imageHit;

  return {
    safe: true,
    isCounterfeitOrBranded: false,
    isBannedCategory: false,
    hasRestrictedWords: false,
    warnings: [],
    summary: "Final VeRO check passed.",
  };
}
