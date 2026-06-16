export type ProductSource = "aliexpress" | "ebay";

export interface ScrapedProduct {
  source: ProductSource;
  externalId: string;
  title: string;
  price: number;
  currency: string;
  url: string;
  scrapedAt: Date;
}

export interface ProductSnapshot extends ScrapedProduct {
  id: string;
}

export interface PriceAlert {
  productId: string;
  previousPrice: number;
  currentPrice: number;
  dropPercent: number;
}
