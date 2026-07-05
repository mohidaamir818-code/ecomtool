import type { Metadata } from "next";
import { LearnEbayPracticeShell } from "@/features/learn-marketplace/components/LearnEbayPracticeShell";
import { LearnMarketplaceBusinessTypePage } from "@/features/learn-marketplace/components/LearnMarketplaceBusinessTypePage";

export const metadata: Metadata = {
  title: "Business type — Learn Marketplace",
};

export default function LearnMarketplaceBusinessTypeRoute() {
  return (
    <LearnEbayPracticeShell>
      <LearnMarketplaceBusinessTypePage />
    </LearnEbayPracticeShell>
  );
}
