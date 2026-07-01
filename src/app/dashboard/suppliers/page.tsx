import type { Metadata } from "next";
import { SupplierFinderShell } from "@/features/suppliers/components/SupplierFinderShell";

export const metadata: Metadata = {
  title: "Suppliers Finder — EcomTools",
  description:
    "Find AliExpress suppliers by keyword, title, or photo with UK and USA stock filters.",
};

export default function SuppliersPage() {
  return <SupplierFinderShell />;
}
