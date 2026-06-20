import "server-only";

import { sendEmail } from "@/lib/email/send-email";

export type StockAlertPriority = "urgent" | "warning" | "info";

export interface StockChange {
  variantLabel: string;
  previousStock: number;
  currentStock: number;
  direction: "up" | "down";
  priority: StockAlertPriority;
}

interface StockAlertProduct {
  title: string;
  imageUrl: string | null;
  productUrl: string;
}

const PRIORITY_COLORS: Record<StockAlertPriority, string> = {
  urgent: "#DC2626",
  warning: "#D97706",
  info: "#2563EB",
};

const PRIORITY_LABELS: Record<StockAlertPriority, string> = {
  urgent: "URGENT — Out of Stock",
  warning: "WARNING — Low Stock",
  info: "Stock Increased",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildStockAlertHtml(
  product: StockAlertProduct,
  change: StockChange,
  listingsUrl: string,
): string {
  const color = PRIORITY_COLORS[change.priority];
  const label = PRIORITY_LABELS[change.priority];
  const arrow = change.direction === "up" ? "↑" : "↓";
  const arrowColor = change.direction === "up" ? "#059669" : "#DC2626";
  const title = escapeHtml(product.title);
  const variantLabel = escapeHtml(change.variantLabel);
  const imageBlock = product.imageUrl
    ? `<img src="${escapeHtml(product.imageUrl)}" alt="" width="120" height="120" style="display:block;border-radius:8px;object-fit:cover;" />`
    : "";

  const outOfStockBanner =
    change.currentStock === 0
      ? `<div style="margin:16px 0;padding:14px 16px;background:#FEE2E2;border:1px solid #DC2626;border-radius:8px;color:#991B1B;font-size:15px;font-weight:700;text-align:center;">
          ⚠️ OUT OF STOCK — Update your eBay listing!
        </div>`
      : "";

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <tr>
      <td style="padding:16px 20px;background:${color};color:#ffffff;font-size:14px;font-weight:700;">
        ${label}
      </td>
    </tr>
    <tr>
      <td style="padding:24px 20px;">
        <h1 style="margin:0 0 16px;font-size:18px;color:#111827;">Stock Alert</h1>
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            ${imageBlock ? `<td width="120" valign="top" style="padding-right:16px;">${imageBlock}</td>` : ""}
            <td valign="top">
              <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#111827;">${title}</p>
              <p style="margin:0 0 12px;font-size:13px;color:#6B7280;">Variant: <strong style="color:#374151;">${variantLabel}</strong></p>
            </td>
          </tr>
        </table>
        <div style="margin:16px 0;padding:16px;background:#F9FAFB;border-radius:8px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;">Max quantity</p>
          <p style="margin:0;font-size:22px;font-weight:700;color:#111827;">
            ${change.previousStock} units
            <span style="color:${arrowColor};margin:0 8px;">${arrow}</span>
            ${change.currentStock} units
          </p>
        </div>
        ${outOfStockBanner}
        <table cellpadding="0" cellspacing="0" style="margin-top:20px;">
          <tr>
            <td style="padding-right:10px;">
              <a href="${escapeHtml(product.productUrl)}" style="display:inline-block;padding:12px 18px;background:#3665F3;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">View on AliExpress</a>
            </td>
            <td>
              <a href="${escapeHtml(listingsUrl)}" style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Update eBay Listing</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildStockAlertText(
  product: StockAlertProduct,
  change: StockChange,
  listingsUrl: string,
): string {
  const arrow = change.direction === "up" ? "↑" : "↓";
  const lines = [
    `Stock Alert - ${product.title}`,
    "",
    `Variant: ${change.variantLabel}`,
    `OLD stock: ${change.previousStock} units`,
    `NEW stock: ${change.currentStock} units ${arrow}`,
  ];

  if (change.currentStock === 0) {
    lines.push("", "⚠️ OUT OF STOCK - Update your eBay listing!");
  }

  lines.push("", `View on AliExpress: ${product.productUrl}`, `Update eBay Listing: ${listingsUrl}`);

  return lines.join("\n");
}

export async function sendStockAlertEmail(
  to: string,
  product: StockAlertProduct,
  change: StockChange,
  appOrigin: string,
): Promise<void> {
  const listingsUrl = appOrigin
    ? `${appOrigin.replace(/\/$/, "")}/dashboard/listings`
    : "/dashboard/listings";

  await sendEmail({
    to,
    subject: `Stock Alert - ${product.title}`,
    text: buildStockAlertText(product, change, listingsUrl),
    html: buildStockAlertHtml(product, change, listingsUrl),
  });
}
