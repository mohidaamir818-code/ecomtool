import { NextRequest, NextResponse } from "next/server";
import { scrapeAliExpressProduct } from "@/lib/scrapers/aliexpress";
import { scrapeEbayProduct } from "@/lib/scrapers/ebay";
import { saveProductSnapshot } from "@/lib/services/price-alerts";
import type { ProductSource } from "@/types/product";

interface ScrapeRequestBody {
  source?: ProductSource;
  url?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ScrapeRequestBody;
    const { source, url } = body;

    if (!source || !url) {
      return NextResponse.json(
        { error: "Missing required fields: source and url" },
        { status: 400 },
      );
    }

    if (source !== "aliexpress" && source !== "ebay") {
      return NextResponse.json(
        { error: "source must be 'aliexpress' or 'ebay'" },
        { status: 400 },
      );
    }

    const product =
      source === "aliexpress"
        ? await scrapeAliExpressProduct(url)
        : await scrapeEbayProduct(url);

    const snapshot = await saveProductSnapshot(product);

    return NextResponse.json({ product, snapshot }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scrape request failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
