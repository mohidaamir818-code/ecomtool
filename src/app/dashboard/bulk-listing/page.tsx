import type { Metadata } from "next";
import { BulkListingShell } from "@/features/bulk-listing/components/BulkListingShell";

export const metadata: Metadata = {
  title: "Bulk Listing — EcomTools",
  description: "List many AliExpress products at once with a spreadsheet-style bulk listing sheet.",
};

export default function BulkListingPage() {
  return <BulkListingShell />;
}
