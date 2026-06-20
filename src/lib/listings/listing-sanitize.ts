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
  "made in china",
  "ships from china",
  "processing time",
  "warehouse",
  "1688",
];

const SUPPLIER_URL_PATTERNS = [
  /aliexpress/i,
  /alibaba/i,
  /dhgate/i,
  /temu/i,
  /1688/i,
  /watermark/i,
  /sale[\s_-]?price/i,
  /promo/i,
  /-sum\./i,
  /[\u4e00-\u9fff]/,
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sanitizeListingText(text: string): string {
  let result = text;
  for (const term of SUPPLIER_TERMS) {
    const pattern = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
    result = result.replace(pattern, " ");
  }
  return result.replace(/\s{2,}/g, " ").trim();
}

export function sanitizeListingHtml(html: string): string {
  return html.replace(/>([^<]+)</g, (match, text: string) => {
    const cleaned = sanitizeListingText(text);
    return cleaned ? `>${cleaned}<` : "><";
  });
}

export function isSupplierImageUrl(url: string): boolean {
  if (!url.trim()) return true;
  const decoded = decodeURIComponent(url);
  return SUPPLIER_URL_PATTERNS.some((pattern) => pattern.test(decoded));
}

export function filterSupplierImages(urls: string[]): string[] {
  return urls.filter((url) => url && !isSupplierImageUrl(url));
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
      name: specific.name,
      value: sanitizeListingText(specific.value),
    })),
  };
}
