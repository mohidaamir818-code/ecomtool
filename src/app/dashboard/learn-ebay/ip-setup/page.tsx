import type { Metadata } from "next";
import { LearnEbayPracticeShell } from "@/features/learn-marketplace/components/LearnEbayPracticeShell";
import { LearnMarketplaceIpSetupPage } from "@/features/learn-marketplace/components/LearnMarketplaceIpSetupPage";

export const metadata: Metadata = {
  title: "IP setup — Learn Marketplace",
};

export default function LearnMarketplaceIpSetupRoute() {
  return (
    <LearnEbayPracticeShell>
      <LearnMarketplaceIpSetupPage />
    </LearnEbayPracticeShell>
  );
}
