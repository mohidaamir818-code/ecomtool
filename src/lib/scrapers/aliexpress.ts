import { fetchAliExpressProduct } from "@/lib/aliexpress/client";
import type { ScrapedProduct } from "@/types/product";

export async function scrapeAliExpressProduct(url: string): Promise<ScrapedProduct> {
  const product = await fetchAliExpressProduct(url);

  return {
    source: "aliexpress",
    externalId: product.externalId,
    title: product.title,
    price: product.price,
    currency: product.currency,
    url: product.productUrl,
    scrapedAt: new Date(),
  };
}
