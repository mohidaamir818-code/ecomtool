import type { ListingDraft } from "@/types/listing-generator";

export const EBAY_BLUE = "#3665F3";
export const EBAY_BLUE_DARK = "#2850D4";
export const EBAY_BORDER = "#E5E5E5";

export const ebayPrimaryButtonClass =
  "rounded-full bg-[#3665F3] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#2850D4] disabled:cursor-not-allowed disabled:opacity-50";

export const ebaySecondaryButtonClass =
  "rounded-full border border-[#3665F3] bg-white px-6 py-2.5 text-sm font-semibold text-[#3665F3] hover:bg-[#F0F5FF] disabled:cursor-not-allowed disabled:opacity-50";

export const ebayTextButtonClass =
  "text-sm font-semibold text-[#3665F3] hover:underline disabled:cursor-not-allowed disabled:opacity-50";

export const ebayBulkButtonClass =
  "rounded border border-[#C5C5C5] bg-white px-3 py-1.5 text-xs font-medium text-[#191919] hover:border-[#3665F3] hover:text-[#3665F3] disabled:cursor-not-allowed disabled:opacity-40";

export const ebayInputClass =
  "w-full rounded border border-[#C5C5C5] px-2 py-1.5 text-sm text-[#191919] outline-none focus:border-[#3665F3]";

export const ebayTableHeaderClass =
  "border-b border-[#E5E5E5] bg-[#F7F7F7] px-3 py-2 text-left text-xs font-semibold text-[#191919]";

export function formatVariantSkuPreview(draft: ListingDraft, variant: ListingDraft["variants"][number]): string {
  return variant.sku?.trim() || draft.product.internalProductSku?.trim() || "";
}

export function currencySymbol(currency: string): string {
  if (currency === "GBP") return "£";
  if (currency === "EUR") return "€";
  if (currency === "USD") return "$";
  return currency;
}
