import "server-only";

import { fetchAliExpressProduct, fetchDescriptionHtmlFromPage, extractImagesFromHtml } from "@/lib/aliexpress/client";
import { cleanLabel, filterListingImages, sanitizeListingText } from "@/lib/listings/listing-sanitize";
import type { ListingProductSource } from "@/types/listing-generator";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-GB,en;q=0.9",
};

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchDescriptionFromHtml(url: string): Promise<{ text: string | null; html: string | null }> {
  try {
    const htmlFromPage = await fetchDescriptionHtmlFromPage(url);
    if (htmlFromPage) {
      const text = stripHtml(htmlFromPage);
      if (text.length >= 20) {
        return { text: text.slice(0, 4000), html: htmlFromPage };
      }
    }

    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      cache: "no-store",
    });

    if (!response.ok) return { text: null, html: null };

    const html = await response.text();
    const patterns = [
      /"description"\s*:\s*"((?:\\.|[^"\\])*)"/,
      /"productDesc"\s*:\s*"((?:\\.|[^"\\])*)"/,
      /property="og:description"\s+content="([^"]+)"/i,
      /<meta\s+name="description"\s+content="([^"]+)"/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (!match?.[1]) continue;

      const decoded = match[1]
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\u0026/g, "&");

      const text = stripHtml(decoded);
      if (text.length >= 20) {
        return {
          text: text.slice(0, 4000),
          html: decoded.includes("<img") ? decoded : null,
        };
      }
    }

    return { text: null, html: null };
  } catch {
    return { text: null, html: null };
  }
}

function dedupeAgainstGallery(urls: string[], gallery: string[]): string[] {
  const gallerySet = new Set(gallery);
  return urls.filter((url) => url && !gallerySet.has(url));
}

export async function fetchListingProductSource(url: string): Promise<ListingProductSource> {
  const product = await fetchAliExpressProduct(url);
  const descriptionPayload = await fetchDescriptionFromHtml(product.productUrl);
  const description = sanitizeListingText(
    product.description?.trim() || descriptionPayload.text || product.title,
  );

  const rawImages =
    product.images?.filter(Boolean) ?? (product.imageUrl ? [product.imageUrl] : []);
  const galleryFilter = filterListingImages(rawImages);
  const images = galleryFilter.allowed;
  const imageUrl = images[0] ?? null;

  const rawDescriptionImages = dedupeAgainstGallery(
    [
      ...(product.descriptionImages ?? []),
      ...(descriptionPayload.html ? extractImagesFromHtml(descriptionPayload.html) : []),
    ],
    images,
  );
  const descriptionFilter = filterListingImages(rawDescriptionImages);

  const variants = product.variants
    ?.filter((variant) => variant.stock != null && variant.stock > 0)
    .map((variant) => {
      const variantFilter = variant.imageUrl
        ? filterListingImages([variant.imageUrl])
        : { allowed: [] as string[], removedCount: 0 };

      return {
        id: variant.id,
        label: cleanLabel(variant.label),
        price: variant.price,
        originalPrice: variant.originalPrice,
        currency: variant.currency,
        stock: variant.stock,
        imageUrl: variantFilter.allowed[0] ?? null,
      };
    })
    .sort((a, b) => {
      const [aFirst, aSecond] = a.label.split(" / ");
      const [bFirst, bSecond] = b.label.split(" / ");
      if (aFirst !== bFirst) return aFirst.localeCompare(bFirst);
      return (aSecond ?? "").localeCompare(bSecond ?? "");
    });

  return {
    source: "aliexpress",
    externalId: product.externalId,
    productUrl: product.productUrl,
    title: sanitizeListingText(product.title),
    imageUrl,
    images,
    descriptionImages: descriptionFilter.allowed,
    imageFilterMeta: {
      galleryRemoved: galleryFilter.removedCount,
      descriptionRemoved: descriptionFilter.removedCount,
    },
    price: product.price,
    currency: product.currency,
    description,
    stock: product.stock,
    variants,
  };
}
