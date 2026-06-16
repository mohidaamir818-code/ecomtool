import type { Metadata } from "next";
import { HuntingShell } from "@/features/hunting/components/HuntingShell";

export const metadata: Metadata = {
  title: "Product Hunting — EcomTools",
  description: "Find winning products by keyword on AliExpress.",
};

export default function HuntingPage() {
  return <HuntingShell />;
}
