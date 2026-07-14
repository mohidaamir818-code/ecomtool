import "server-only";

import { getSellerMarketplaceId, resolveMarketplaceConfig } from "@/lib/ebay/marketplace";
import { getEbayUserAccessToken } from "@/lib/ebay/oauth-user";

const EBAY_API_BASE = "https://api.ebay.com";

interface EbayMoney {
  value?: string;
  currency?: string;
}

export interface EbayFulfillmentOrder {
  orderId: string;
  creationDate: string;
  salesRecordReference?: string;
  orderFulfillmentStatus?: string;
  cancelStatus?: { cancelState?: string };
  buyer?: { username?: string };
  lineItems?: Array<{ lineItemId?: string; legacyItemId?: string }>;
  pricingSummary?: {
    total?: EbayMoney;
    priceSubtotal?: EbayMoney;
    deliveryCost?: EbayMoney;
  };
  paymentSummary?: {
    totalDueSeller?: EbayMoney;
    refunds?: Array<{ amount?: EbayMoney }>;
  };
  /** Amount used to calculate marketplace fees (item + shipping, typically excludes remit tax). */
  totalFeeBasisAmount?: EbayMoney;
  /** eBay marketplace / final-value fees for the order (excludes promoted listing ads). */
  totalMarketplaceFee?: EbayMoney;
}

function ebayHeaders(token: string, marketplaceId: string): HeadersInit {
  const config = resolveMarketplaceConfig(marketplaceId);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-EBAY-C-MARKETPLACE-ID": config.marketplaceId,
  };
}

function parseMoney(value: EbayMoney | undefined): { amount: number; currency: string } {
  const amount = Number.parseFloat(value?.value ?? "0");
  return {
    amount: Number.isFinite(amount) ? amount : 0,
    currency: value?.currency ?? "GBP",
  };
}

export async function fetchEbayOrdersForRange(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<EbayFulfillmentOrder[]> {
  const token = await getEbayUserAccessToken(userId);
  if (!token) {
    throw new Error("Connect your eBay account first.");
  }

  const marketplaceId = await getSellerMarketplaceId(userId);
  const orders: EbayFulfillmentOrder[] = [];
  let offset = 0;
  const limit = 100;

  while (offset < 1000) {
    const url = new URL(`${EBAY_API_BASE}/sell/fulfillment/v1/order`);
    url.searchParams.set("filter", `creationdate:[${fromIso}..${toIso}]`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));

    const response = await fetch(url.toString(), {
      headers: ebayHeaders(token, marketplaceId),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      orders?: EbayFulfillmentOrder[];
      errors?: Array<{ message?: string }>;
    };

    if (!response.ok) {
      throw new Error(data.errors?.[0]?.message ?? "Failed to fetch eBay orders.");
    }

    const batch = data.orders ?? [];
    orders.push(...batch);

    if (batch.length < limit) break;
    offset += limit;
  }

  return orders;
}

async function enrichFulfillmentOrder(
  token: string,
  marketplaceId: string,
  order: EbayFulfillmentOrder,
): Promise<EbayFulfillmentOrder> {
  const response = await fetch(
    `${EBAY_API_BASE}/sell/fulfillment/v1/order/${encodeURIComponent(order.orderId)}`,
    {
      headers: ebayHeaders(token, marketplaceId),
      cache: "no-store",
    },
  );

  if (!response.ok) return order;

  const data = (await response.json()) as EbayFulfillmentOrder;
  return {
    ...order,
    ...data,
    salesRecordReference: data.salesRecordReference ?? order.salesRecordReference,
    lineItems: data.lineItems ?? order.lineItems,
    pricingSummary: data.pricingSummary ?? order.pricingSummary,
    paymentSummary: data.paymentSummary ?? order.paymentSummary,
    totalMarketplaceFee: data.totalMarketplaceFee ?? order.totalMarketplaceFee,
    totalFeeBasisAmount: data.totalFeeBasisAmount ?? order.totalFeeBasisAmount,
  };
}

export async function fetchEbayOrdersForRangeWithDetails(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<EbayFulfillmentOrder[]> {
  const token = await getEbayUserAccessToken(userId);
  if (!token) {
    throw new Error("Connect your eBay account first.");
  }

  const marketplaceId = await getSellerMarketplaceId(userId);
  const orders = await fetchEbayOrdersForRange(userId, fromIso, toIso);
  return Promise.all(orders.map((order) => enrichFulfillmentOrder(token, marketplaceId, order)));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function extractOrderFinancials(order: EbayFulfillmentOrder): {
  sellingPrice: number;
  fees: number;
  netSale: number;
  payoutAmount: number;
  refundAmount: number;
  currency: string;
  orderStatus: "completed" | "cancelled" | "refunded" | "partial_refund";
} {
  const feeBasis = parseMoney(order.totalFeeBasisAmount);
  const total = parseMoney(order.pricingSummary?.total);
  const subtotal = parseMoney(order.pricingSummary?.priceSubtotal);
  const delivery = parseMoney(order.pricingSummary?.deliveryCost);
  const dueSeller = parseMoney(order.paymentSummary?.totalDueSeller);
  const marketplaceFee = parseMoney(order.totalMarketplaceFee);

  // Prefer fee basis (matches eBay fee calculator / order fee line). Avoid buyer tax on top.
  const sellingPrice =
    feeBasis.amount > 0
      ? round2(feeBasis.amount)
      : total.amount > 0
        ? round2(total.amount)
        : round2(subtotal.amount + delivery.amount);

  const refundAmount = round2(
    (order.paymentSummary?.refunds ?? []).reduce((sum, refund) => {
      const amount = parseMoney(refund.amount).amount;
      return sum + (amount > 0 ? amount : 0);
    }, 0),
  );

  const cancelState = order.cancelStatus?.cancelState?.toUpperCase() ?? "";
  const fulfillmentStatus = order.orderFulfillmentStatus?.toUpperCase() ?? "";

  let orderStatus: "completed" | "cancelled" | "refunded" | "partial_refund" = "completed";
  if (cancelState.includes("CANCEL") || fulfillmentStatus.includes("CANCEL")) {
    orderStatus = "cancelled";
  } else if (refundAmount > 0 && refundAmount >= sellingPrice * 0.99) {
    orderStatus = "refunded";
  } else if (refundAmount > 0) {
    orderStatus = "partial_refund";
  }

  // Actual bank/payout amount from eBay (may also deduct promoted listing fees).
  const payoutAmount = orderStatus === "cancelled" ? 0 : round2(Math.max(0, dueSeller.amount));

  // Marketplace fee only — matches eBay fee / profit calculator (not ad fees).
  const fees =
    marketplaceFee.amount > 0
      ? round2(marketplaceFee.amount)
      : round2(Math.max(0, sellingPrice - payoutAmount - refundAmount));

  // Net sale after eBay marketplace fees (before supplier cost and refunds).
  const netSale = orderStatus === "cancelled" ? 0 : round2(Math.max(0, sellingPrice - fees));

  const currency =
    feeBasis.currency || dueSeller.currency || total.currency || marketplaceFee.currency || "GBP";

  return {
    sellingPrice,
    fees,
    netSale,
    payoutAmount,
    refundAmount,
    currency,
    orderStatus,
  };
}
