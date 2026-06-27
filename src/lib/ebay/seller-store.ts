import "server-only";

import { buildEbayListingUrl, getSellerMarketplaceId, resolveMarketplaceConfig } from "@/lib/ebay/marketplace";
import { getEbayUserAccessToken } from "@/lib/ebay/oauth-user";
import { getListedProducts } from "@/lib/listings/listed-products-service";
import type { StoreImportListing, StoreImportVariant } from "@/types/store-import";

const TRADING_SITE_ID: Record<string, string> = {
  EBAY_GB: "3",
  EBAY_US: "0",
  EBAY_DE: "77",
};

const MAX_IMPORT_PAGES = 3;
const ENTRIES_PER_PAGE = 200;

interface BrowseStoreRow {
  listingId: string;
  listingUrl: string;
  title: string;
  imageUrl: string | null;
  price: number;
  currency: string;
  label: string;
  quantity: number;
}

function tradingSiteId(marketplaceId: Awaited<ReturnType<typeof getSellerMarketplaceId>>): string {
  return TRADING_SITE_ID[marketplaceId] ?? TRADING_SITE_ID.EBAY_GB;
}

function xmlTagValue(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]?.trim() ?? null;
}

async function tradingApiRequest(
  accessToken: string,
  siteId: string,
  callName: string,
  body: string,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch("https://api.ebay.com/ws/api.dll", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        "X-EBAY-API-CALL-NAME": callName,
        "X-EBAY-API-SITEID": siteId,
        "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
        "X-EBAY-API-IAF-TOKEN": accessToken,
      },
      body,
      cache: "no-store",
      signal: controller.signal,
    });
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseVariationLabel(varBlock: string): string | null {
  const values = [...varBlock.matchAll(/<NameValueList>[\s\S]*?<Value>([^<]*)<\/Value>/gi)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
  return values.length > 0 ? values.join(" / ") : null;
}

async function fetchSellerActiveListRows(
  accessToken: string,
  marketplaceId: Awaited<ReturnType<typeof getSellerMarketplaceId>>,
): Promise<BrowseStoreRow[]> {
  const siteId = tradingSiteId(marketplaceId);
  const config = resolveMarketplaceConfig(marketplaceId);
  const rows: BrowseStoreRow[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_IMPORT_PAGES) {
    let xml = "";
    try {
      xml = await tradingApiRequest(
        accessToken,
        siteId,
        "GetMyeBaySelling",
        `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ActiveList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>${ENTRIES_PER_PAGE}</EntriesPerPage>
      <PageNumber>${page}</PageNumber>
    </Pagination>
  </ActiveList>
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>`,
      );
    } catch {
      break;
    }

    if (/Ack>Failure</i.test(xml)) break;

    const totalPagesStr = xmlTagValue(xml, "TotalNumberOfPages");
    totalPages = Number(totalPagesStr) || 1;

    const itemBlocks = xml.match(/<Item>[\s\S]*?<\/Item>/gi) ?? [];
    for (const block of itemBlocks) {
      const listingId = xmlTagValue(block, "ItemID");
      if (!listingId) continue;

      const title = xmlTagValue(block, "Title") ?? `Listing ${listingId}`;
      const galleryUrl = xmlTagValue(block, "GalleryURL");
      const priceMatch = block.match(
        /<SellingStatus>[\s\S]*?<CurrentPrice[^>]*currencyID="([^"]*)"[^>]*>([^<]*)<\/CurrentPrice>/i,
      );
      const currency = priceMatch?.[1] ?? config.currency;
      const price = Number(priceMatch?.[2] ?? 0);
      if (!Number.isFinite(price) || price <= 0) continue;

      const itemQuantity = Number(xmlTagValue(block, "Quantity") ?? "1");
      const variationBlocks = block.match(/<Variation>[\s\S]*?<\/Variation>/gi) ?? [];

      if (variationBlocks.length > 0) {
        for (const varBlock of variationBlocks) {
          const varPrice = Number(xmlTagValue(varBlock, "StartPrice") ?? price);
          const varQty = Number(xmlTagValue(varBlock, "Quantity") ?? itemQuantity);
          rows.push({
            listingId,
            listingUrl: buildEbayListingUrl(listingId, marketplaceId),
            title,
            imageUrl: galleryUrl,
            price: Number.isFinite(varPrice) && varPrice > 0 ? varPrice : price,
            currency,
            label: parseVariationLabel(varBlock) ?? "Default",
            quantity: Number.isFinite(varQty) && varQty >= 0 ? varQty : 1,
          });
        }
      } else {
        rows.push({
          listingId,
          listingUrl: buildEbayListingUrl(listingId, marketplaceId),
          title,
          imageUrl: galleryUrl,
          price,
          currency,
          label: "Default",
          quantity: Number.isFinite(itemQuantity) && itemQuantity >= 0 ? itemQuantity : 1,
        });
      }
    }

    page += 1;
  }

  return rows;
}

function groupBrowseRows(rows: BrowseStoreRow[]): Map<string, BrowseStoreRow[]> {
  const grouped = new Map<string, BrowseStoreRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.listingId) ?? [];
    list.push(row);
    grouped.set(row.listingId, list);
  }
  return grouped;
}

function buildVariants(browseRows: BrowseStoreRow[]): StoreImportVariant[] {
  return browseRows.map((row, index) => ({
    sku: row.listingId,
    offerId: row.listingId,
    label: row.label || (browseRows.length > 1 ? `Variant ${index + 1}` : "Default"),
    price: row.price,
    quantity: row.quantity,
    imageUrl: row.imageUrl,
  }));
}

export async function fetchSellerEbayStore(userId: string): Promise<StoreImportListing[]> {
  const token = await getEbayUserAccessToken(userId);
  if (!token) {
    throw new Error("eBay account is not connected. Connect eBay first.");
  }

  const marketplaceId = await getSellerMarketplaceId(userId);
  const browseRows = await fetchSellerActiveListRows(token, marketplaceId);
  const grouped = groupBrowseRows(browseRows);
  const listings: StoreImportListing[] = [];

  for (const [listingId, rows] of grouped.entries()) {
    const primary = rows[0];
    if (!primary) continue;

    const variants = buildVariants(rows);
    if (variants.length === 0) continue;

    listings.push({
      listingId,
      listingUrl: buildEbayListingUrl(listingId, marketplaceId) || primary.listingUrl,
      title: primary.title,
      imageUrl: primary.imageUrl ?? variants.find((variant) => variant.imageUrl)?.imageUrl ?? null,
      currency: primary.currency,
      variants,
      groupSku: variants.length > 1 ? listingId : null,
      linked: false,
      listedProductId: null,
      aliexpressUrl: null,
    });
  }

  let savedByListingId = new Map<string, { id: string; aliexpressUrl: string }>();
  try {
    const saved = await getListedProducts(userId);
    savedByListingId = new Map(
      saved
        .filter((product) => product.platform === "ebay" && product.listingId)
        .map((product) => [
          product.listingId as string,
          { id: product.id, aliexpressUrl: product.aliexpressUrl },
        ]),
    );
  } catch {
    // listing import should still work if saved-product lookup fails
  }

  return listings
    .map((listing) => {
      const savedProduct = savedByListingId.get(listing.listingId);
      if (!savedProduct) return listing;
      return {
        ...listing,
        linked: true,
        listedProductId: savedProduct.id,
        aliexpressUrl: savedProduct.aliexpressUrl,
      };
    })
    .sort((a, b) => {
      if (a.linked === b.linked) return a.title.localeCompare(b.title);
      return a.linked ? 1 : -1;
    });
}
