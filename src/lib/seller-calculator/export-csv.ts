import type { SellerCalculatorMonth } from "@/types/seller-calculator";

export function buildCalculatorCsv(month: SellerCalculatorMonth): string {
  const headers = [
    "Date",
    "Order no / Name",
    "Cost Price",
    "eBay Order No",
    "Selling Price",
    "Fees",
    "Net Sale",
    "Profit",
    "ROI",
    "Refunds Amount",
    "Payouts",
    "Status",
  ];

  const totals = month.totals;
  const totalsRow = [
    "TOTAL",
    "",
    totals.costPrice.toFixed(2),
    "",
    totals.sellingPrice.toFixed(2),
    totals.fees.toFixed(2),
    totals.netSale.toFixed(2),
    totals.profit.toFixed(2),
    totals.roi == null ? "" : `${totals.roi.toFixed(2)}%`,
    totals.refundAmount.toFixed(2),
    "",
    "",
  ];

  const rows = month.orders.map((row) => [
    row.orderDateLabel,
    row.supplierOrderId ?? row.ebayOrderId,
    row.costPrice.toFixed(2),
    row.ebayOrderId,
    row.sellingPrice.toFixed(2),
    row.fees.toFixed(2),
    row.netSale.toFixed(2),
    row.profit.toFixed(2),
    row.roi == null ? "" : `${row.roi.toFixed(2)}%`,
    row.refundAmount.toFixed(2),
    row.payoutAmount == null ? row.netSale.toFixed(2) : row.payoutAmount.toFixed(2),
    row.orderStatus,
  ]);

  return [totalsRow, headers, ...rows]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
