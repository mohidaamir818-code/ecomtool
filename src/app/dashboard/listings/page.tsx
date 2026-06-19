import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingsShell } from "@/features/listings/components/ListingsShell";

export const metadata: Metadata = {
  title: "AI Listing Generator — EcomTools",
  description: "Generate eBay listings from AliExpress products with AI and VeRO safety checks.",
};

export default function ListingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] text-sm text-[#6B7280]">
          Loading...
        </div>
      }
    >
      <ListingsShell />
    </Suspense>
  );
}
