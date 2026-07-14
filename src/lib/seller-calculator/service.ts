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

function buildTotals(orders: SellerCalculatorOrderRow[], currency: string): SellerCalculatorTotals {
  const costPrice = orders.reduce((sum, row) => sum + row.costPrice, 0);
  const sellingPrice = orders.reduce((sum, row) => sum + row.sellingPrice, 0);
  const fees = orders.reduce((sum, row) => sum + row.fees, 0);
  const netSale = orders.reduce((sum, row) => sum + row.netSale, 0);
  const profit = orders.reduce((sum, row) => sum + row.profit, 0);
  const refundAmount = orders.reduce((sum, row) => sum + row.refundAmount, 0);
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
  const fees = Number(row.fees);
  const netSale = Number(row.net_sale);
  const profit = Number(row.profit);
  const refundAmount = Number(row.refund_amount ?? 0);
  const roi = row.roi != null ? Number(row.roi) : null;
  const orderDate = String(row.order_date);

  return {
    id: String(row.id),
    ebayOrderId: String(row.ebay_order_id),
    orderDate,
    orderDateLabel: formatOrderDateLabel(orderDate),
    supplierOrderId: row.supplier_order_id ? String(row.supplier_order_id) : null,
    buyerName: row.buyer_name ? String(row.buyer_name) : null,
    costPrice,
    sellingPrice,
    fees,
    netSale,
    profit,
    roi,
    refundAmount,
    payoutAmount: row.payout_amount != null ? Number(row.payout_amount) : null,
    orderStatus: String(row.order_status) as SellerCalculatorOrderRow["orderStatus"],
    currency,
    costPriceLabel: formatMoney(costPrice, currency),
    sellingPriceLabel: formatMoney(sellingPrice, currency),
    feesLabel: formatMoney(fees, currency),
    netSaleLabel: formatMoney(netSale, currency),
    profitLabel: formatMoney(profit, currency),
    refundAmountLabel: formatMoney(refundAmount, currency),
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
    .select("ebay_order_id")
    .eq("user_id", userId);

  if (existingError) throw new Error(existingError.message);

  const existingIds = new Set((existingRows ?? []).map((row) => String(row.ebay_order_id)));

  const { from, to } = getMonthDateRange(year, month);
  const [ebayOrders, notesMap] = await Promise.all([
    fetchEbayOrdersForRangeWithDetails(userId, from, to),
    fetchSellerOrderNotesMap(userId, from, to),
  ]);

  let addedCount = 0;
  let skippedNoNote = 0;
  const inserts: Array<Record<string, unknown>> = [];

  for (const order of ebayOrders) {
    if (!order.orderId || existingIds.has(order.orderId)) continue;

    const noteText = resolveOrderNote(notesMap, {
      orderId: order.orderId,
      salesRecordReference: order.salesRecordReference,
      lineItemIds: (order.lineItems ?? [])
        .map((lineItem) => lineItem.lineItemId)
        .filter((lineItemId): lineItemId is string => Boolean(lineItemId)),
    });
    const parsedNote = parseSupplierNote(noteText);
    if (!parsedNote) {
      skippedNoNote += 1;
      continue;
    }

    const financials = extractOrderFinancials(order);
    const costPrice = parsedNote.costPrice;
    const netSale =
      financials.orderStatus === "refunded"
        ? 0
        : Math.max(0, financials.netSale - financials.refundAmount);
    const profit = Math.round((netSale - costPrice) * 100) / 100;
    const roi = computeRoi(profit, costPrice);
    const orderDate = order.creationDate.slice(0, 10);

    inserts.push({
      user_id: userId,
      month_id: monthId,
      ebay_order_id: order.orderId,
      order_date: orderDate,
      supplier_order_id: parsedNote.supplierOrderId,
      buyer_name: order.buyer?.username ?? null,
      cost_price: costPrice,
      selling_price: financials.sellingPrice,
      fees: financials.fees,
      net_sale: netSale,
      profit,
      roi,
      refund_amount: financials.refundAmount,
      payout_amount: netSale,
      order_status: financials.orderStatus,
      currency: financials.currency,
    });

    existingIds.add(order.orderId);
    addedCount += 1;
  }

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from("seller_calculator_orders").insert(inserts);
    if (insertError) throw new Error(insertError.message);
  }

  const now = new Date().toISOString();
  await supabase
    .from("seller_calculator_months")
    .update({ last_synced_at: now })
    .eq("id", monthId);

  const { month: refreshed } = await getSellerCalculatorMonth(userId, year, month);
  if (!refreshed) throw new Error("Failed to load calculator month.");

  const message =
    addedCount > 0
      ? `Added ${addedCount} new order${addedCount === 1 ? "" : "s"} with supplier notes.`
      : ebayOrders.length > 0 && skippedNoNote > 0
        ? notesMap.size > 0
          ? `Found ${ebayOrders.length} eBay orders but could not match supplier notes to them. Try syncing again after a minute, or reconnect eBay.`
          : `Found ${ebayOrders.length} eBay order${ebayOrders.length === 1 ? "" : "s"} for this month, but eBay did not return My notes yet. Add notes on eBay (e.g. 3074386016281530 2.79) then sync again.`
        : skippedNoNote > 0
          ? "No new orders with supplier notes found."
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
