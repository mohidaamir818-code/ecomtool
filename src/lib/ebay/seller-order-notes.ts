import "server-only";

import { getSellerMarketplaceId } from "@/lib/ebay/marketplace";
import { getEbayUserAccessToken } from "@/lib/ebay/oauth-user";

const TRADING_SITE_ID: Record<string, string> = {
  EBAY_GB: "3",
  EBAY_US: "0",
  EBAY_DE: "77",
};

const ENTRIES_PER_PAGE = 200;
const MAX_PAGES = 20;

function tradingSiteId(marketplaceId: string): string {
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

/** Map eBay order ID -> seller "My note" text from Trading API SoldList. */
export async function fetchSellerOrderNotesMap(userId: string): Promise<Map<string, string>> {
  const token = await getEbayUserAccessToken(userId);
  if (!token) return new Map();

  const marketplaceId = await getSellerMarketplaceId(userId);
  const siteId = tradingSiteId(marketplaceId);
  const notes = new Map<string, string>();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let xml = "";
    try {
      xml = await tradingApiRequest(
        token,
        siteId,
        "GetMyeBaySelling",
        `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <SoldList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>${ENTRIES_PER_PAGE}</EntriesPerPage>
      <PageNumber>${page}</PageNumber>
    </Pagination>
    <DurationInDays>90</DurationInDays>
  </SoldList>
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>`,
      );
    } catch {
      break;
    }

    if (/Ack>Failure</i.test(xml)) break;

    const transactions =
      xml.match(/<OrderTransaction>[\s\S]*?<\/OrderTransaction>/gi) ?? [];

    for (const block of transactions) {
      const note = xmlTagValue(block, "PrivateNotes");
      if (!note) continue;

      const extendedOrderId = xmlTagValue(block, "ExtendedOrderID");
      const orderId = xmlTagValue(block, "OrderID");

      if (extendedOrderId) notes.set(extendedOrderId, note);
      if (orderId) notes.set(orderId, note);
    }

    const totalPages = Number(xmlTagValue(xml, "TotalNumberOfPages") ?? "1");
    if (page >= totalPages) break;
  }

  return notes;
}

export function resolveOrderNote(
  notesMap: Map<string, string>,
  orderId: string,
): string | null {
  return notesMap.get(orderId) ?? null;
}
