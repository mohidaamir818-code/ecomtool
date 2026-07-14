import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingsShell } from "@/features/listings/components/ListingsShell";

export const metadata: Metadata = {
  title: "Auto List — EcomTools",
  description: "Paste an AliExpress URL, review your listing, then publish to eBay.",
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
