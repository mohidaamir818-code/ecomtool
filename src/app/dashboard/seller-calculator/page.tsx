import type { Metadata } from "next";
import { SellerCalculatorShell } from "@/features/seller-calculator/components/SellerCalculatorShell";

export const metadata: Metadata = {
  title: "Seller Calculator — EcomTools",
  description: "Monthly profit sheet from your eBay orders and supplier notes.",
};

export default function SellerCalculatorPage() {
  return <SellerCalculatorShell />;
}
