import type { Metadata } from "next";
import { LearnEbayPracticeShell } from "@/features/learn-marketplace/components/LearnEbayPracticeShell";
import { LearnMarketplacePayoutInformationPage } from "@/features/learn-marketplace/components/LearnMarketplacePayoutInformationPage";

export const metadata: Metadata = {
  title: "Payout information — Learn Marketplace",
};

export default function LearnMarketplacePayoutInformationRoute() {
  return (
    <LearnEbayPracticeShell>
      <LearnMarketplacePayoutInformationPage />
    </LearnEbayPracticeShell>
  );
}
