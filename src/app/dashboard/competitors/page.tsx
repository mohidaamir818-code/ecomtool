import type { Metadata } from "next";
import { CompetitorsShell } from "@/features/competitors/components/CompetitorsShell";

export const metadata: Metadata = {
  title: "Check Competitors — EcomTools",
  description: "Compare your selling price against Amazef and eBay competitors.",
};

export default function CompetitorsPage() {
  return <CompetitorsShell />;
}
