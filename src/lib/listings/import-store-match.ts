import "server-only";

import {
  searchDropshipProducts,
  searchDropshipProductsByImage,
} from "@/lib/aliexpress/dropship-search-client";
import type { StoreImportListing, StoreImportSuggestedMatch } from "@/types/store-import";

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleWordOverlap(aliTitle: string, ebayTitle: string): number {
  const aliWords = new Set(
    normalizeTitle(aliTitle)
      .split(" ")
      .filter((word) => word.length > 2),
  );
  const ebayWords = new Set(
    normalizeTitle(ebayTitle)
      .split(" ")
      .filter((word) => word.length > 2),
  );

  if (aliWords.size === 0 || ebayWords.size === 0) return 0;

  let overlap = 0;
  for (const word of aliWords) {
    if (ebayWords.has(word)) overlap += 1;
  }

  return overlap / Math.max(aliWords.size, ebayWords.size);
}

async function fetchImageAsDataUrl(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl.replace(/^http:\/\//, "https://"), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/*,*/*",
      },
      cache: "no-store",
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    if (!contentType.startsWith("image/")) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > 4 * 1024 * 1024) return null;

    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function suggestAliExpressMatchForListing(
  listing: StoreImportListing,
): Promise<StoreImportSuggestedMatch | null> {
  const candidates: Array<{
    productUrl: string;
    title: string;
    imageUrl: string | null;
    price: number;
    currency: string;
    productId: string;
  }> = [];

  if (listing.imageUrl?.trim()) {
    try {
      const imageDataUrl = await fetchImageAsDataUrl(listing.imageUrl.trim());
      if (imageDataUrl) {
        const imageResult = await searchDropshipProductsByImage({
          imageDataUrl,
          stockRegion: "any",
          pageSize: 10,
        });
        for (const product of imageResult.products) {
          candidates.push({
            productId: product.productId,
            productUrl:
              product.productUrl ??
              `https://www.aliexpress.com/item/${product.productId}.html`,
            title: product.title,
            imageUrl: product.imageUrl,
            price: product.price,
            currency: product.currency,
          });
        }
      }
    } catch {
      // Fall back to title search below.
    }
  }

  if (candidates.length === 0) {
    const keywords = listing.title.trim().replace(/\s+/g, " ").slice(0, 100);
    if (keywords.length >= 2) {
      try {
        const textResult = await searchDropshipProducts({
          keywords,
          stockRegion: "any",
          pageSize: 10,
        });
        for (const product of textResult.products) {
          candidates.push({
            productId: product.productId,
            productUrl:
              product.productUrl ??
              `https://www.aliexpress.com/item/${product.productId}.html`,
            title: product.title,
            imageUrl: product.imageUrl,
            price: product.price,
            currency: product.currency,
          });
        }
      } catch {
        return null;
      }
    }
  }

  if (candidates.length === 0) return null;

  let best = candidates[0]!;
  let bestScore = titleWordOverlap(best.title, listing.title);

  for (const candidate of candidates.slice(1)) {
    const score = titleWordOverlap(candidate.title, listing.title);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (bestScore < 0.25) return null;

  return {
    aliexpressUrl: best.productUrl,
    title: best.title,
    imageUrl: best.imageUrl,
    price: best.price,
    currency: best.currency,
    confidence: Math.round(bestScore * 100),
  };
}
