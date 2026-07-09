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
  orderFulfillmentStatus?: string;
  cancelStatus?: { cancelState?: string };
  buyer?: { username?: string };
  pricingSummary?: {
    total?: EbayMoney;
    priceSubtotal?: EbayMoney;
    deliveryCost?: EbayMoney;
  };
  paymentSummary?: {
    totalDueSeller?: EbayMoney;
    refunds?: Array<{ amount?: EbayMoney }>;
  };
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

export function extractOrderFinancials(order: EbayFulfillmentOrder): {
  sellingPrice: number;
  fees: number;
  netSale: number;
  refundAmount: number;
  currency: string;
  orderStatus: "completed" | "cancelled" | "refunded" | "partial_refund";
} {
  const total = parseMoney(order.pricingSummary?.total);
  const subtotal = parseMoney(order.pricingSummary?.priceSubtotal);
  const delivery = parseMoney(order.pricingSummary?.deliveryCost);
  const dueSeller = parseMoney(order.paymentSummary?.totalDueSeller);

  const sellingPrice =
    total.amount > 0 ? total.amount : subtotal.amount + delivery.amount;

  const netSale = dueSeller.amount;
  const fees = Math.max(0, Math.round((sellingPrice - netSale) * 100) / 100);

  const refundAmount = (order.paymentSummary?.refunds ?? []).reduce((sum, refund) => {
    const amount = parseMoney(refund.amount).amount;
    return sum + (amount > 0 ? amount : 0);
  }, 0);

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

  const currency = dueSeller.currency || total.currency || "GBP";

  return {
    sellingPrice,
    fees,
    netSale: orderStatus === "cancelled" ? 0 : netSale,
    refundAmount,
    currency,
    orderStatus,
  };
}
