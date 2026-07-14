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
/** eBay caps SoldList.DurationInDays at 60 — higher values can fail the whole call. */
const DURATION_IN_DAYS = 60;

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
  return id.replace(/[^\dA-Za-z-]/g, "").toLowerCase();
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

function registerNote(notes: Map<string, string>, orderId: string | null | undefined, note: string): void {
  if (!orderId || !note.trim()) return;
  const trimmed = orderId.trim();
  notes.set(trimmed, note);
  notes.set(normalizeOrderId(trimmed), note);
}

function extractNoteText(block: string): string | null {
  return (
    xmlTagValue(block, "PrivateNotes") ??
    xmlTagValue(block, "SellerNotes") ??
    xmlTagValue(block, "Notes") ??
    null
  );
}

function registerTransactionNote(
  notes: Map<string, string>,
  transactionBlock: string,
  orderId: string | null,
  note: string,
): void {
  const lineItemId = xmlTagValue(transactionBlock, "OrderLineItemID");
  const transactionId = xmlTagValue(transactionBlock, "TransactionID");
  const itemBlock = transactionBlock.match(/<Item>[\s\S]*?<\/Item>/i)?.[0] ?? transactionBlock;
  const itemId = xmlTagValue(itemBlock, "ItemID");
  const extendedOrderId = xmlTagValue(transactionBlock, "ExtendedOrderID");
  const salesRecord =
    xmlTagValue(transactionBlock, "SellingManagerSalesRecordNumber") ??
    xmlTagValue(transactionBlock, "SalesRecordNumber");

  registerNote(notes, orderId, note);
  registerNote(notes, extendedOrderId, note);
  registerNote(notes, lineItemId, note);
  registerNote(notes, salesRecord, note);
  registerNote(notes, itemId, note);

  if (itemId && transactionId != null) {
    registerNote(notes, `${itemId}-${transactionId}`, note);
  }
}

function parseOrderTransactionNotes(xml: string, notes: Map<string, string>): void {
  const orderTransactions = xml.match(/<OrderTransaction>[\s\S]*?<\/OrderTransaction>/gi) ?? [];

  for (const orderTransaction of orderTransactions) {
    const orderBlock = orderTransaction.match(/<Order>[\s\S]*?<\/Order>/i)?.[0] ?? "";
    const orderId =
      xmlTagValue(orderBlock, "OrderID") ??
      xmlTagValue(orderBlock, "ExtendedOrderID") ??
      xmlTagValue(orderTransaction, "OrderID") ??
      xmlTagValue(orderTransaction, "ExtendedOrderID");

    const transactionBlocks = orderTransaction.match(/<Transaction>[\s\S]*?<\/Transaction>/gi) ?? [];
    for (const transactionBlock of transactionBlocks) {
      const itemBlock = transactionBlock.match(/<Item>[\s\S]*?<\/Item>/i)?.[0] ?? transactionBlock;
      const note = extractNoteText(itemBlock) ?? extractNoteText(transactionBlock);
      if (!note) continue;
      registerTransactionNote(notes, transactionBlock, orderId, note);
    }
  }
}

function parseOrderNotes(xml: string, notes: Map<string, string>): void {
  const orders = xml.match(/<Order>[\s\S]*?<\/Order>/gi) ?? [];

  for (const orderBlock of orders) {
    const orderId = xmlTagValue(orderBlock, "OrderID") ?? xmlTagValue(orderBlock, "ExtendedOrderID");
    const orderLevelNote = extractNoteText(orderBlock);
    if (orderLevelNote) registerNote(notes, orderId, orderLevelNote);

    const transactionBlocks = orderBlock.match(/<Transaction>[\s\S]*?<\/Transaction>/gi) ?? [];

    for (const transactionBlock of transactionBlocks) {
      const itemBlock = transactionBlock.match(/<Item>[\s\S]*?<\/Item>/i)?.[0] ?? transactionBlock;
      const note = extractNoteText(itemBlock) ?? extractNoteText(transactionBlock) ?? orderLevelNote;
      if (!note) continue;
      registerTransactionNote(notes, transactionBlock, orderId, note);
    }
  }
}

function parseStandaloneTransactionNotes(xml: string, notes: Map<string, string>): void {
  const transactions = xml.match(/<Transaction>[\s\S]*?<\/Transaction>/gi) ?? [];

  for (const transactionBlock of transactions) {
    const itemBlock = transactionBlock.match(/<Item>[\s\S]*?<\/Item>/i)?.[0] ?? transactionBlock;
    const note = extractNoteText(itemBlock) ?? extractNoteText(transactionBlock);
    if (!note) continue;

    registerTransactionNote(
      notes,
      transactionBlock,
      xmlTagValue(transactionBlock, "ExtendedOrderID") ?? xmlTagValue(transactionBlock, "OrderID"),
      note,
    );
  }
}

function parseNotesFromXml(xml: string, notes: Map<string, string>): void {
  parseOrderTransactionNotes(xml, notes);
  parseOrderNotes(xml, notes);
  parseStandaloneTransactionNotes(xml, notes);
}

function responseHasData(xml: string): boolean {
  return /Ack>(Success|Warning|PartialFailure)</i.test(xml);
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

    if (!responseHasData(xml)) break;

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

    if (!responseHasData(xml)) break;

    parseNotesFromXml(xml, notes);

    const totalPages = Number(xmlTagValue(xml, "TotalNumberOfPages") ?? "1");
    if (page >= totalPages) break;
  }
}

async function fetchSellerTransactionsNotes(
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
        "GetSellerTransactions",
        `<?xml version="1.0" encoding="utf-8"?>
<GetSellerTransactionsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <DetailLevel>ReturnAll</DetailLevel>
  <IncludeContainingOrder>true</IncludeContainingOrder>
  <ModTimeFrom>${fromIso}</ModTimeFrom>
  <ModTimeTo>${toIso}</ModTimeTo>
  <Pagination>
    <EntriesPerPage>${ENTRIES_PER_PAGE}</EntriesPerPage>
    <PageNumber>${page}</PageNumber>
  </Pagination>
</GetSellerTransactionsRequest>`,
      );
    } catch {
      break;
    }

    if (!responseHasData(xml)) break;

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
    await Promise.all([
      fetchTradingGetOrdersNotes(token, siteId, fromIso, toIso, notes),
      fetchSellerTransactionsNotes(token, siteId, fromIso, toIso, notes),
    ]);
  }

  return notes;
}

export interface OrderNoteLookup {
  orderId: string;
  salesRecordReference?: string | null;
  lineItemIds?: string[];
  legacyItemIds?: string[];
}

function lookupNote(notesMap: Map<string, string>, key: string): string | null {
  const direct = notesMap.get(key);
  if (direct) return direct;

  const normalized = normalizeOrderId(key);
  const normalizedHit = notesMap.get(normalized);
  if (normalizedHit) return normalizedHit;

  for (const [mapKey, value] of notesMap) {
    if (normalizeOrderId(mapKey) === normalized) return value;
  }

  return null;
}

export function resolveOrderNote(notesMap: Map<string, string>, order: OrderNoteLookup): string | null {
  const keys = [
    order.orderId,
    order.salesRecordReference ?? undefined,
    ...(order.lineItemIds ?? []),
    ...(order.legacyItemIds ?? []),
  ].filter((key): key is string => Boolean(key));

  for (const key of keys) {
    const hit = lookupNote(notesMap, key);
    if (hit) return hit;
  }

  // Loose fallback: map key contained in order id (or reverse)
  const normalizedOrder = normalizeOrderId(order.orderId);
  for (const [mapKey, value] of notesMap) {
    const normalizedKey = normalizeOrderId(mapKey);
    if (!normalizedKey || normalizedKey.length < 6) continue;
    if (normalizedOrder.includes(normalizedKey) || normalizedKey.includes(normalizedOrder)) {
      return value;
    }
  }

  return null;
}
