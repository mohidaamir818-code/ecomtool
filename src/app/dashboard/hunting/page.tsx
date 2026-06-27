import type { Metadata } from "next";
import { HuntProShell } from "@/features/hunting/components/HuntProShell";

export const metadata: Metadata = {
  title: "Product Hunting — EcomTools",
  description: "Find winning products by keyword from eBay sold listings with HuntPro.",
};

export default function HuntingPage() {
  return <HuntProShell />;
}
