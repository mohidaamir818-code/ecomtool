import "server-only";

import {
  extractOrderFinancials,
  fetchEbayOrdersForRangeWithDetails,
} from "@/lib/ebay/sell-fulfillment";
import { fetchSellerOrderNotesMap, resolveOrderNote } from "@/lib/ebay/seller-order-notes";
import { getEbayConnectionStatus } from "@/lib/ebay/oauth-user";
import {
  formatMoney,
  formatOrderDateLabel,
  getMonthDateRange,
  monthLabel,
} from "@/lib/seller-calculator/format";
import { parseSupplierNote } from "@/lib/seller-calculator/parse-note";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  SellerCalculatorMonth,
  SellerCalculatorOrderRow,
  SellerCalculatorTotals,
} from "@/types/seller-calculator";

function computeRoi(profit: number, costPrice: number): number | null {
  if (costPrice <= 0) return null;
  return Math.round((profit / costPrice) * 10000) / 100;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Match seller Google Sheet formulas:
 *   Net Sale = Selling Price − Fees
 *   Profit   = Net Sale − Cost Price
 *   ROI      = Profit / Cost Price
 * Refunds stay as their own column and are not subtracted from profit.
 */
function deriveOrderAmounts(input: {
  sellingPrice: number;
  fees: number;
  netSale: number;
  costPrice: number;
  refundAmount: number;
  payoutAmount: number | null;
  orderStatus: SellerCalculatorOrderRow["orderStatus"];
  currency: string;
}): Pick<
  SellerCalculatorOrderRow,
  | "fees"
  | "netSale"
  | "profit"
  | "roi"
  | "payoutAmount"
  | "feesLabel"
  | "netSaleLabel"
  | "profitLabel"
  | "refundAmountLabel"
> {
  const sellingPrice = round2(input.sellingPrice);
  const costPrice = round2(input.costPrice);
  const refundAmount = round2(input.refundAmount);
  const currency = input.currency;

  if (input.orderStatus === "cancelled") {
    return {
      fees: 0,
      netSale: 0,
      profit: 0,
      roi: null,
      payoutAmount: 0,
      feesLabel: formatMoney(0, currency),
      netSaleLabel: formatMoney(0, currency),
      profitLabel: formatMoney(0, currency),
      refundAmountLabel: formatMoney(refundAmount, currency),
    };
  }

  const fees = round2(Math.max(0, input.fees));
  const netSale = round2(sellingPrice - fees);
  const profit = round2(netSale - costPrice);
  const roi = computeRoi(profit, costPrice);
  const payoutAmount =
    input.payoutAmount != null ? round2(Math.max(0, input.payoutAmount)) : netSale;

  return {
    fees,
    netSale,
    profit,
    roi,
    payoutAmount,
    feesLabel: formatMoney(fees, currency),
    netSaleLabel: formatMoney(netSale, currency),
    profitLabel: formatMoney(profit, currency),
    refundAmountLabel: formatMoney(refundAmount, currency),
  };
}

function buildTotals(orders: SellerCalculatorOrderRow[], currency: string): SellerCalculatorTotals {
  const costPrice = round2(orders.reduce((sum, row) => sum + row.costPrice, 0));
  const sellingPrice = round2(orders.reduce((sum, row) => sum + row.sellingPrice, 0));
  const fees = round2(orders.reduce((sum, row) => sum + row.fees, 0));
  const netSale = round2(orders.reduce((sum, row) => sum + row.netSale, 0));
  const profit = round2(orders.reduce((sum, row) => sum + row.profit, 0));
  const refundAmount = round2(orders.reduce((sum, row) => sum + row.refundAmount, 0));
  const roi = computeRoi(profit, costPrice);

  return {
    costPrice,
    sellingPrice,
    fees,
    netSale,
    profit,
    roi,
    refundAmount,
    costPriceLabel: formatMoney(costPrice, currency),
    sellingPriceLabel: formatMoney(sellingPrice, currency),
    feesLabel: formatMoney(fees, currency),
    netSaleLabel: formatMoney(netSale, currency),
    profitLabel: formatMoney(profit, currency),
    refundAmountLabel: formatMoney(refundAmount, currency),
    roiLabel: roi == null ? "—" : `${roi.toFixed(2)}%`,
  };
}

function mapOrderRow(row: Record<string, unknown>): SellerCalculatorOrderRow {
  const currency = String(row.currency ?? "GBP");
  const costPrice = Number(row.cost_price);
  const sellingPrice = Number(row.selling_price);
  const refundAmount = Number(row.refund_amount ?? 0);
  const orderDate = String(row.order_date);
  const orderStatus = String(row.order_status) as SellerCalculatorOrderRow["orderStatus"];

  const derived = deriveOrderAmounts({
    sellingPrice,
    fees: Number(row.fees),
    netSale: Number(row.net_sale),
    costPrice,
    refundAmount,
    payoutAmount: row.payout_amount != null ? Number(row.payout_amount) : null,
    orderStatus,
    currency,
  });

  return {
    id: String(row.id),
    ebayOrderId: String(row.ebay_order_id),
    orderDate,
    orderDateLabel: formatOrderDateLabel(orderDate),
    supplierOrderId: row.supplier_order_id ? String(row.supplier_order_id) : null,
    buyerName: row.buyer_name ? String(row.buyer_name) : null,
    costPrice,
    sellingPrice,
    fees: derived.fees,
    netSale: derived.netSale,
    profit: derived.profit,
    roi: derived.roi,
    refundAmount,
    payoutAmount: derived.payoutAmount,
    orderStatus,
    currency,
    costPriceLabel: formatMoney(costPrice, currency),
    sellingPriceLabel: formatMoney(sellingPrice, currency),
    feesLabel: derived.feesLabel,
    netSaleLabel: derived.netSaleLabel,
    profitLabel: derived.profitLabel,
    refundAmountLabel: derived.refundAmountLabel,
  };
}

async function ensureMonthRow(
  userId: string,
  year: number,
  month: number,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("seller_calculator_months")
    .select("*")
    .eq("user_id", userId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("seller_calculator_months")
    .insert({ user_id: userId, year, month, status: "open" })
    .select("*");

  if (error) throw new Error(error.message);
  const row = created?.[0];
  if (!row) throw new Error("Failed to create calculator month.");
  return row;
}

async function loadMonthOrders(
  userId: string,
  monthId: string,
): Promise<SellerCalculatorOrderRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("seller_calculator_orders")
    .select("*")
    .eq("user_id", userId)
    .eq("month_id", monthId)
    .order("order_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapOrderRow);
}

export async function getSellerCalculatorMonth(
  userId: string,
  year: number,
  month: number,
): Promise<{ connected: boolean; month: SellerCalculatorMonth | null }> {
  const connection = await getEbayConnectionStatus(userId);
  const monthRow = await ensureMonthRow(userId, year, month);
  const orders = await loadMonthOrders(userId, String(monthRow.id));
  const currency = orders[0]?.currency ?? "GBP";

  const payload: SellerCalculatorMonth = {
    id: String(monthRow.id),
    year,
    month,
    monthLabel: monthLabel(year, month),
    status: monthRow.status === "closed" ? "closed" : "open",
    lastSyncedAt: monthRow.last_synced_at ? String(monthRow.last_synced_at) : null,
    orderCount: orders.length,
    totals: buildTotals(orders, currency),
    orders,
  };

  return { connected: connection.connected, month: payload };
}

export async function syncSellerCalculatorMonth(
  userId: string,
  year: number,
  month: number,
): Promise<{
  month: SellerCalculatorMonth;
  addedCount: number;
  skippedNoNote: number;
  ebayOrdersFound: number;
  message: string;
}> {
  const monthRow = await ensureMonthRow(userId, year, month);
  const monthId = String(monthRow.id);
  const supabase = getSupabaseAdmin();

  const { data: existingRows, error: existingError } = await supabase
    .from("seller_calculator_orders")
    .select("id, ebay_order_id, cost_price, supplier_order_id")
    .eq("user_id", userId);

  if (existingError) throw new Error(existingError.message);

  const existingByOrderId = new Map(
    (existingRows ?? []).map((row) => [
      String(row.ebay_order_id),
      {
        id: String(row.id),
        costPrice: Number(row.cost_price),
        supplierOrderId: row.supplier_order_id ? String(row.supplier_order_id) : null,
      },
    ]),
  );

  const { from, to } = getMonthDateRange(year, month);
  const [ebayOrders, notesMap] = await Promise.all([
    fetchEbayOrdersForRangeWithDetails(userId, from, to),
    fetchSellerOrderNotesMap(userId, from, to),
  ]);

  let addedCount = 0;
  let updatedCount = 0;
  let skippedNoNote = 0;
  const inserts: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];

  for (const order of ebayOrders) {
    if (!order.orderId) continue;

    const noteText = resolveOrderNote(notesMap, {
      orderId: order.orderId,
      salesRecordReference: order.salesRecordReference,
      lineItemIds: (order.lineItems ?? [])
        .map((lineItem) => lineItem.lineItemId)
        .filter((lineItemId): lineItemId is string => Boolean(lineItemId)),
      legacyItemIds: (order.lineItems ?? [])
        .map((lineItem) => lineItem.legacyItemId)
        .filter((legacyItemId): legacyItemId is string => Boolean(legacyItemId)),
    });
    const parsedNote = parseSupplierNote(noteText);
    const existing = existingByOrderId.get(order.orderId);

    if (!existing && (!noteText?.trim() || !parsedNote)) {
      skippedNoNote += 1;
      continue;
    }

    const financials = extractOrderFinancials(order);
    const costPrice = parsedNote?.costPrice ?? existing?.costPrice ?? 0;
    const supplierOrderId = parsedNote?.supplierOrderId ?? existing?.supplierOrderId ?? null;
    const derived = deriveOrderAmounts({
      sellingPrice: financials.sellingPrice,
      fees: financials.fees,
      netSale: financials.netSale,
      costPrice,
      refundAmount: financials.refundAmount,
      payoutAmount: financials.payoutAmount,
      orderStatus: financials.orderStatus,
      currency: financials.currency,
    });
    const orderDate = order.creationDate.slice(0, 10);

    const payload = {
      user_id: userId,
      month_id: monthId,
      ebay_order_id: order.orderId,
      order_date: orderDate,
      supplier_order_id: supplierOrderId,
      buyer_name: order.buyer?.username ?? null,
      cost_price: costPrice,
      selling_price: financials.sellingPrice,
      fees: derived.fees,
      net_sale: derived.netSale,
      profit: derived.profit,
      roi: derived.roi,
      refund_amount: financials.refundAmount,
      payout_amount: derived.payoutAmount,
      order_status: financials.orderStatus,
      currency: financials.currency,
    };

    if (existing) {
      updates.push({ id: existing.id, ...payload });
      updatedCount += 1;
    } else {
      inserts.push(payload);
      existingByOrderId.set(order.orderId, {
        id: "pending",
        costPrice,
        supplierOrderId,
      });
      addedCount += 1;
    }
  }

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from("seller_calculator_orders").insert(inserts);
    if (insertError) throw new Error(insertError.message);
  }

  for (const update of updates) {
    const { id, ...fields } = update;
    const { error: updateError } = await supabase
      .from("seller_calculator_orders")
      .update(fields)
      .eq("id", String(id))
      .eq("user_id", userId);
    if (updateError) throw new Error(updateError.message);
  }

  const now = new Date().toISOString();
  await supabase
    .from("seller_calculator_months")
    .update({ last_synced_at: now })
    .eq("id", monthId);

  const { month: refreshed } = await getSellerCalculatorMonth(userId, year, month);
  if (!refreshed) throw new Error("Failed to load calculator month.");

  const message =
    addedCount > 0 || updatedCount > 0
      ? [
          addedCount > 0 ? `Added ${addedCount} new order${addedCount === 1 ? "" : "s"}` : null,
          updatedCount > 0
            ? `updated ${updatedCount} existing order${updatedCount === 1 ? "" : "s"}`
            : null,
        ]
          .filter(Boolean)
          .join(", ") + " with corrected totals."
      : ebayOrders.length > 0 && skippedNoNote > 0
        ? notesMap.size > 0
          ? `Found ${ebayOrders.length} eBay orders but could not match notes to them. Try syncing again after a minute, or reconnect eBay.`
          : `Found ${ebayOrders.length} eBay order${ebayOrders.length === 1 ? "" : "s"} for this month, but eBay did not return any notes yet. Add a note on eBay then sync again.`
        : skippedNoNote > 0
          ? "No new orders with notes found."
          : "No new orders to add.";

  return { month: refreshed, addedCount, skippedNoNote, ebayOrdersFound: ebayOrders.length, message };
}

export async function closeSellerCalculatorMonth(
  userId: string,
  year: number,
  month: number,
): Promise<{ month: SellerCalculatorMonth; addedCount: number; message: string }> {
  const result = await syncSellerCalculatorMonth(userId, year, month);
  const supabase = getSupabaseAdmin();

  await supabase
    .from("seller_calculator_months")
    .update({ status: "closed" })
    .eq("id", result.month.id)
    .eq("user_id", userId);

  const { month: refreshed } = await getSellerCalculatorMonth(userId, year, month);
  if (!refreshed) throw new Error("Failed to load calculator month.");

  return {
    month: { ...refreshed, status: "closed" },
    addedCount: result.addedCount,
    message:
      result.addedCount > 0
        ? `Month closed. Added ${result.addedCount} remaining order${result.addedCount === 1 ? "" : "s"}.`
        : "Month closed. No remaining orders with notes.",
  };
}
