const SUPPLIER_TERMS = [
  "aliexpress",
  "alibaba",
  "china",
  "dropshipping",
  "dropship",
  "supplier",
  "wholesale",
  "dhgate",
  "temu",
  "shein",
  "made in china",
  "ships from china",
  "processing time",
  "warehouse",
  "1688",
];

const RESTRICTED_URL_KEYWORDS = [
  "aliexpress",
  "alibaba",
  "dropship",
  "dhgate",
  "temu",
  "shein",
  "china",
  "supplier",
  "wholesale",
];

const RESTRICTED_BRAND_KEYWORDS = [
  "nike",
  "adidas",
  "apple",
  "samsung",
  "sony",
  "gucci",
  "louisvuitton",
  "louis-vuitton",
  "prada",
  "chanel",
  "rolex",
  "microsoft",
  "google",
  "canon",
  "dyson",
];

const RESTRICTED_URL_PATTERNS = [
  /[\u4e00-\u9fff]/,
  /[$£€]\s*\d+/,
  /\d+\s*[$£€]/,
  /\bsale\b/i,
  /\bdeal\b/i,
  /\bpromo\b/i,
  /%\s*off/i,
  /%off/i,
  /\bdiscount\b/i,
  /processing[\s_-]?time/i,
  /delivery[\s_-]?time/i,
  /shipping[\s_-]?time/i,
  /\bwww\./i,
  /\.cn\//i,
  /watermark/i,
  /sale[\s_-]?price/i,
  /-sum\./i,
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CHINA_LABEL_PATTERNS: RegExp[] = [
  /\bChina Mainland\b/gi,
  /\bMainland China\b/gi,
  /\bShips from China\b/gi,
  /\bMade in China\b/gi,
  /\bChina\b/gi,
];

/** Remove China-related origin text from listing-facing labels and attributes. */
export function cleanLabel(text: string): string {
  let result = text;
  for (const pattern of CHINA_LABEL_PATTERNS) {
    result = result.replace(pattern, " ");
  }

  return result
    .replace(/\s*\/\s*\/+\s*/g, " / ")
    .replace(/(?:^|\s)\/\s*(?:\/\s*)+/g, " ")
    .replace(/\s*,\s*,+/g, ", ")
    .replace(/^\s*[\/,]\s*|\s*[\/,]\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function decodeUrlSafe(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

export function sanitizeListingText(text: string): string {
  let result = text;
  for (const term of SUPPLIER_TERMS) {
    const pattern = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
    result = result.replace(pattern, " ");
  }
  return cleanLabel(result.replace(/\s{2,}/g, " ").trim());
}

export function sanitizeListingHtml(html: string): string {
  return html.replace(/>([^<]+)</g, (match, text: string) => {
    const cleaned = sanitizeListingText(text);
    return cleaned ? `>${cleaned}<` : "><";
  });
}

export function isRestrictedImageUrl(url: string): boolean {
  if (!url.trim()) return true;

  const decoded = decodeUrlSafe(url).toLowerCase();

  for (const keyword of RESTRICTED_URL_KEYWORDS) {
    if (decoded.includes(keyword)) return true;
  }

  for (const brand of RESTRICTED_BRAND_KEYWORDS) {
    if (decoded.includes(brand)) return true;
  }

  return RESTRICTED_URL_PATTERNS.some((pattern) => pattern.test(decoded));
}

export function isSupplierImageUrl(url: string): boolean {
  return isRestrictedImageUrl(url);
}

const DESCRIPTION_IMAGE_URL_KEYWORDS = [
  "aliexpress",
  "alibaba",
  "dropship",
  "china",
  "supplier",
  "wholesale",
];

export function isDescriptionImageUrlRestricted(url: string): boolean {
  if (!url.trim()) return true;

  const decoded = decodeUrlSafe(url).toLowerCase();

  for (const keyword of DESCRIPTION_IMAGE_URL_KEYWORDS) {
    if (decoded.includes(keyword)) return true;
  }

  return /[\u4e00-\u9fff]/.test(decoded);
}

export function filterDescriptionImageUrls(urls: string[]): {
  allowed: string[];
  removedCount: number;
} {
  const allowed: string[] = [];
  let removedCount = 0;

  for (const url of urls) {
    if (!url?.trim()) {
      removedCount += 1;
      continue;
    }
    if (isDescriptionImageUrlRestricted(url)) {
      removedCount += 1;
    } else {
      allowed.push(url);
    }
  }

  return { allowed, removedCount };
}

export function filterListingImages(urls: string[]): {
  allowed: string[];
  removedCount: number;
} {
  const allowed: string[] = [];
  let removedCount = 0;

  for (const url of urls) {
    if (!url?.trim()) {
      removedCount += 1;
      continue;
    }
    if (isRestrictedImageUrl(url)) {
      removedCount += 1;
    } else {
      allowed.push(url);
    }
  }

  return { allowed, removedCount };
}

export function filterSupplierImages(urls: string[]): string[] {
  return filterListingImages(urls).allowed;
}

export function sanitizeListingContent(input: {
  seoTitle: string;
  descriptionHtml: string;
  itemSpecifics: Array<{ name: string; value: string }>;
}): {
  seoTitle: string;
  descriptionHtml: string;
  itemSpecifics: Array<{ name: string; value: string }>;
} {
  return {
    seoTitle: sanitizeListingText(input.seoTitle),
    descriptionHtml: sanitizeListingHtml(input.descriptionHtml),
    itemSpecifics: input.itemSpecifics.map((specific) => ({
      name: cleanLabel(sanitizeListingText(specific.name)),
      value: cleanLabel(sanitizeListingText(specific.value)),
    })),
  };
}
