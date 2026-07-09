import "server-only";

import { getSellerMarketplaceId } from "@/lib/ebay/marketplace";
import { getEbayUserAccessToken } from "@/lib/ebay/oauth-user";

const TRADING_SITE_ID: Record<string, string> = {
  EBAY_GB: "3",
  EBAY_US: "0",
  EBAY_DE: "77",
};

const ENTRIES_PER_PAGE = 200;
const MAX_PAGES = 25;
const DURATION_IN_DAYS = 120;

function tradingSiteId(marketplaceId: string): string {
  return TRADING_SITE_ID[marketplaceId] ?? TRADING_SITE_ID.EBAY_GB;
}

function xmlTagValue(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!match?.[1]) return null;
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/i, "$1")
    .trim();
}

function normalizeOrderId(id: string): string {
  return id.replace(/[^\dA-Za-z]/g, "").toLowerCase();
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

function registerNote(notes: Map<string, string>, orderId: string | null, note: string): void {
  if (!orderId || !note.trim()) return;
  notes.set(orderId, note);
  notes.set(normalizeOrderId(orderId), note);
}

function registerNoteFromBlock(block: string, note: string, notes: Map<string, string>): void {
  registerNote(notes, xmlTagValue(block, "ExtendedOrderID"), note);
  registerNote(notes, xmlTagValue(block, "OrderID"), note);
  registerNote(notes, xmlTagValue(block, "OrderLineItemID"), note);

  const transactionBlocks = block.match(/<Transaction>[\s\S]*?<\/Transaction>/gi) ?? [];
  for (const transactionBlock of transactionBlocks) {
    registerNote(notes, xmlTagValue(transactionBlock, "ExtendedOrderID"), note);
    registerNote(notes, xmlTagValue(transactionBlock, "OrderID"), note);
    registerNote(notes, xmlTagValue(transactionBlock, "OrderLineItemID"), note);
  }
}

function parseNotesFromXml(xml: string, notes: Map<string, string>): void {
  const blocks = [
    ...(xml.match(/<OrderTransaction>[\s\S]*?<\/OrderTransaction>/gi) ?? []),
    ...(xml.match(/<Item>[\s\S]*?<\/Item>/gi) ?? []),
    ...(xml.match(/<Transaction>[\s\S]*?<\/Transaction>/gi) ?? []),
    ...(xml.match(/<Order>[\s\S]*?<\/Order>/gi) ?? []),
  ];

  for (const block of blocks) {
    const noteMatches = block.matchAll(/<PrivateNotes>([\s\S]*?)<\/PrivateNotes>/gi);
    for (const match of noteMatches) {
      const note = match[1]
        ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/i, "$1")
        .trim();
      if (!note) continue;
      registerNoteFromBlock(block, note, notes);
    }
  }
}

async function fetchMyEbaySellingListNotes(
  token: string,
  siteId: string,
  listName: "SoldList" | "DeletedFromSoldList",
  notes: Map<string, string>,
): Promise<void> {
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let xml = "";
    try {
      xml = await tradingApiRequest(
        token,
        siteId,
        "GetMyeBaySelling",
        `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <${listName}>
    <Include>true</Include>
    <IncludeNotes>true</IncludeNotes>
    <Pagination>
      <EntriesPerPage>${ENTRIES_PER_PAGE}</EntriesPerPage>
      <PageNumber>${page}</PageNumber>
    </Pagination>
    <DurationInDays>${DURATION_IN_DAYS}</DurationInDays>
  </${listName}>
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>`,
      );
    } catch {
      break;
    }

    if (/Ack>Failure</i.test(xml)) break;

    parseNotesFromXml(xml, notes);

    const listBlock = xml.match(new RegExp(`<${listName}>[\\s\\S]*?<\\/${listName}>`, "i"))?.[0] ?? xml;
    const totalPages = Number(xmlTagValue(listBlock, "TotalNumberOfPages") ?? "1");
    if (page >= totalPages) break;
  }
}

async function fetchTradingGetOrdersNotes(
  token: string,
  siteId: string,
  fromIso: string,
  toIso: string,
  notes: Map<string, string>,
): Promise<void> {
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let xml = "";
    try {
      xml = await tradingApiRequest(
        token,
        siteId,
        "GetOrders",
        `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <DetailLevel>ReturnAll</DetailLevel>
  <CreateTimeFrom>${fromIso}</CreateTimeFrom>
  <CreateTimeTo>${toIso}</CreateTimeTo>
  <OrderRole>Seller</OrderRole>
  <OrderStatus>All</OrderStatus>
  <Pagination>
    <EntriesPerPage>${ENTRIES_PER_PAGE}</EntriesPerPage>
    <PageNumber>${page}</PageNumber>
  </Pagination>
</GetOrdersRequest>`,
      );
    } catch {
      break;
    }

    if (/Ack>Failure</i.test(xml)) break;

    parseNotesFromXml(xml, notes);

    const totalPages = Number(xmlTagValue(xml, "TotalNumberOfPages") ?? "1");
    if (page >= totalPages) break;
  }
}

/** Map eBay order ID -> seller "My note" text from Trading API sold lists. */
export async function fetchSellerOrderNotesMap(
  userId: string,
  fromIso?: string,
  toIso?: string,
): Promise<Map<string, string>> {
  const token = await getEbayUserAccessToken(userId);
  if (!token) return new Map();

  const marketplaceId = await getSellerMarketplaceId(userId);
  const siteId = tradingSiteId(marketplaceId);
  const notes = new Map<string, string>();

  await fetchMyEbaySellingListNotes(token, siteId, "SoldList", notes);
  await fetchMyEbaySellingListNotes(token, siteId, "DeletedFromSoldList", notes);

  if (fromIso && toIso) {
    await fetchTradingGetOrdersNotes(token, siteId, fromIso, toIso, notes);
  }

  return notes;
}

export function resolveOrderNote(
  notesMap: Map<string, string>,
  orderId: string,
): string | null {
  const direct = notesMap.get(orderId);
  if (direct) return direct;

  const normalized = normalizeOrderId(orderId);
  const normalizedHit = notesMap.get(normalized);
  if (normalizedHit) return normalizedHit;

  for (const [key, value] of notesMap) {
    if (normalizeOrderId(key) === normalized) return value;
  }

  return null;
}
