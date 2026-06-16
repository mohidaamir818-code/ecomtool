import type { Metadata } from "next";
import { ProductsHandlingShell } from "@/features/handling/components/ProductsHandlingShell";

export const metadata: Metadata = {
  title: "Products Handling — EcomTools",
  description: "Track AliExpress products for price and stock changes.",
};

export default function ProductsHandlingPage() {
  return <ProductsHandlingShell />;
}
