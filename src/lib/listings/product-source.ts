import "server-only";

import { fetchAliExpressProduct } from "@/lib/aliexpress/client";
import { filterSupplierImages, sanitizeListingText } from "@/lib/listings/listing-sanitize";
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

async function fetchDescriptionFromHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      cache: "no-store",
    });

    if (!response.ok) return null;

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
      if (text.length >= 20) return text.slice(0, 4000);
    }

    return null;
  } catch {
    return null;
  }
}

export async function fetchListingProductSource(url: string): Promise<ListingProductSource> {
  const product = await fetchAliExpressProduct(url);
  const description = sanitizeListingText(
    product.description?.trim() ||
      (await fetchDescriptionFromHtml(product.productUrl)) ||
      product.title,
  );

  const rawImages =
    product.images?.filter(Boolean) ?? (product.imageUrl ? [product.imageUrl] : []);
  const images = filterSupplierImages(rawImages);
  const imageUrl = images[0] ?? null;

  const variants = product.variants
    ?.filter((variant) => variant.stock != null && variant.stock > 0)
    .map((variant) => ({
      id: variant.id,
      label: variant.label,
      price: variant.price,
      currency: variant.currency,
      stock: variant.stock,
      imageUrl: variant.imageUrl
        ? filterSupplierImages([variant.imageUrl])[0] ?? null
        : null,
    }));

  return {
    source: "aliexpress",
    externalId: product.externalId,
    productUrl: product.productUrl,
    title: sanitizeListingText(product.title),
    imageUrl,
    images,
    price: product.price,
    currency: product.currency,
    description,
    stock: product.stock,
    variants,
  };
}
