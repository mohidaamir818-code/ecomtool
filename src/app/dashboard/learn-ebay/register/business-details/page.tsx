import type { Metadata } from "next";
import { LearnEbayPracticeShell } from "@/features/learn-marketplace/components/LearnEbayPracticeShell";
import { LearnMarketplaceBusinessDetailsPage } from "@/features/learn-marketplace/components/LearnMarketplaceBusinessDetailsPage";

export const metadata: Metadata = {
  title: "Business details — Learn Marketplace",
};

export default function LearnMarketplaceBusinessDetailsRoute() {
  return (
    <LearnEbayPracticeShell>
      <LearnMarketplaceBusinessDetailsPage />
    </LearnEbayPracticeShell>
  );
}
