import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingsShell } from "@/features/listings/components/ListingsShell";

export const metadata: Metadata = {
  title: "Create New Listing — EcomTools",
  description: "Paste an AliExpress URL and create an optimized eBay listing with AI.",
};

export default function NewListingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] text-sm text-[#6B7280]">
          Loading...
        </div>
      }
    >
      <ListingsShell mode="create" />
    </Suspense>
  );
}
