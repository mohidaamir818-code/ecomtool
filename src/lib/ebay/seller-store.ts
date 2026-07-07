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

const MAX_IMPORT_PAGES = 10;
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
  sku: string;
  variationSpecifics: Array<{ name: string; value: string }>;
}

function tradingSiteId(marketplaceId: Awaited<ReturnType<typeof getSellerMarketplaceId>>): string {
  return TRADING_SITE_ID[marketplaceId] ?? TRADING_SITE_ID.EBAY_GB;
}

function xmlTagValue(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]?.trim() ?? null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

function parseVariationSpecifics(varBlock: string): Array<{ name: string; value: string }> {
  const blocks = varBlock.match(/<NameValueList>[\s\S]*?<\/NameValueList>/gi) ?? [];
  return blocks
    .map((block) => ({
      name: xmlTagValue(block, "Name") ?? "",
      value: xmlTagValue(block, "Value") ?? "",
    }))
    .filter((entry) => entry.name && entry.value);
}

function parseVariationLabel(varBlock: string): string | null {
  const specifics = parseVariationSpecifics(varBlock);
  if (specifics.length === 0) return null;
  return specifics.map((entry) => entry.value).join(" / ");
}

function parseListingStatus(itemBlock: string): string | null {
  const sellingStatus = itemBlock.match(/<SellingStatus>[\s\S]*?<\/SellingStatus>/i)?.[0] ?? itemBlock;
  return xmlTagValue(sellingStatus, "ListingStatus");
}

function parseAvailableQuantity(block: string, fallbackQty: number): number {
  const quantity = Number(xmlTagValue(block, "Quantity") ?? String(fallbackQty));
  const sold = Number(xmlTagValue(block, "QuantitySold") ?? "0");
  if (!Number.isFinite(quantity)) return fallbackQty;
  const available = quantity - (Number.isFinite(sold) ? sold : 0);
  return available >= 0 ? available : fallbackQty;
}

function isActiveListingItem(itemBlock: string): boolean {
  const listingStatus = parseListingStatus(itemBlock);
  if (listingStatus && listingStatus.toLowerCase() !== "active") {
    return false;
  }

  const quantityAvailable = parseAvailableQuantity(itemBlock, 0);
  const variationBlocks = itemBlock.match(/<Variation>[\s\S]*?<\/Variation>/gi) ?? [];
  if (variationBlocks.length > 0) {
    return variationBlocks.some((varBlock) => parseAvailableQuantity(varBlock, 0) > 0);
  }

  return quantityAvailable > 0;
}

function extractActiveListXml(xml: string): string {
  const activeListMatch = xml.match(/<ActiveList>[\s\S]*?<\/ActiveList>/i);
  return activeListMatch?.[0] ?? xml;
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

    const activeListXml = extractActiveListXml(xml);
    const totalPagesStr = xmlTagValue(activeListXml, "TotalNumberOfPages");
    totalPages = Number(totalPagesStr) || 1;

    const itemBlocks = activeListXml.match(/<Item>[\s\S]*?<\/Item>/gi) ?? [];
    for (const block of itemBlocks) {
      if (!isActiveListingItem(block)) continue;

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

      const itemQuantity = parseAvailableQuantity(block, 1);
      const variationBlocks = block.match(/<Variation>[\s\S]*?<\/Variation>/gi) ?? [];

      if (variationBlocks.length > 0) {
        for (const varBlock of variationBlocks) {
          const availableQty = parseAvailableQuantity(varBlock, itemQuantity);
          if (availableQty <= 0) continue;

          const varPrice = Number(xmlTagValue(varBlock, "StartPrice") ?? price);
          const variationSpecifics = parseVariationSpecifics(varBlock);
          const variationSku = xmlTagValue(varBlock, "SKU")?.trim() || `${listingId}-${rows.length + 1}`;
          rows.push({
            listingId,
            listingUrl: buildEbayListingUrl(listingId, marketplaceId),
            title,
            imageUrl: galleryUrl,
            price: Number.isFinite(varPrice) && varPrice > 0 ? varPrice : price,
            currency,
            label: parseVariationLabel(varBlock) ?? "Default",
            quantity: availableQty,
            sku: variationSku,
            variationSpecifics,
          });
        }
      } else if (itemQuantity > 0) {
        rows.push({
          listingId,
          listingUrl: buildEbayListingUrl(listingId, marketplaceId),
          title,
          imageUrl: galleryUrl,
          price,
          currency,
          label: "Default",
          quantity: itemQuantity,
          sku: xmlTagValue(block, "SKU")?.trim() || listingId,
          variationSpecifics: [],
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
    sku: row.sku,
    offerId: row.listingId,
    label: row.label || (browseRows.length > 1 ? `Variant ${index + 1}` : "Default"),
    price: row.price,
    quantity: row.quantity,
    imageUrl: row.imageUrl,
    variationSpecifics: row.variationSpecifics.length > 0 ? row.variationSpecifics : undefined,
  }));
}

export async function reviseEbayTradingListing(
  userId: string,
  listingId: string,
  patch: {
    price?: number;
    quantity?: number;
    label?: string;
    sku?: string;
    variationSpecifics?: Array<{ name: string; value: string }>;
  },
): Promise<void> {
  const token = await getEbayUserAccessToken(userId);
  if (!token) {
    throw new Error("eBay account is not connected. Reconnect eBay first.");
  }

  const marketplaceId = await getSellerMarketplaceId(userId);
  const siteId = tradingSiteId(marketplaceId);
  const hasVariation =
    (patch.variationSpecifics?.length ?? 0) > 0 ||
    (patch.label && patch.label !== "Default" && patch.label.includes("/"));

  let itemXml = `<Item><ItemID>${escapeXml(listingId)}</ItemID>`;

  if (hasVariation) {
    const specifics =
      patch.variationSpecifics && patch.variationSpecifics.length > 0
        ? patch.variationSpecifics
        : (patch.label ?? "Default")
            .split("/")
            .map((value, index) => ({
              name: `Option ${index + 1}`,
              value: value.trim(),
            }))
            .filter((entry) => entry.value);

    itemXml += "<Variations><Variation>";
    if (patch.sku?.trim()) {
      itemXml += `<SKU>${escapeXml(patch.sku.trim())}</SKU>`;
    }
    itemXml += "<VariationSpecifics>";
    for (const specific of specifics) {
      itemXml += `<NameValueList><Name>${escapeXml(specific.name)}</Name><Value>${escapeXml(specific.value)}</Value></NameValueList>`;
    }
    itemXml += "</VariationSpecifics>";
    if (patch.price != null) {
      itemXml += `<StartPrice>${patch.price.toFixed(2)}</StartPrice>`;
    }
    if (patch.quantity != null) {
      itemXml += `<Quantity>${Math.max(0, Math.floor(patch.quantity))}</Quantity>`;
    }
    itemXml += "</Variation></Variations>";
  } else {
    if (patch.price != null) {
      itemXml += `<StartPrice>${patch.price.toFixed(2)}</StartPrice>`;
    }
    if (patch.quantity != null) {
      itemXml += `<Quantity>${Math.max(0, Math.floor(patch.quantity))}</Quantity>`;
    }
  }

  itemXml += "</Item>";

  const xml = await tradingApiRequest(
    token,
    siteId,
    "ReviseFixedPriceItem",
    `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  ${itemXml}
</ReviseFixedPriceItemRequest>`,
  );

  if (/Ack>Failure</i.test(xml)) {
    throw new Error(xmlTagValue(xml, "LongMessage") ?? "Failed to update eBay listing.");
  }
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

  return listings.filter((listing) => !savedByListingId.has(listing.listingId));
}
