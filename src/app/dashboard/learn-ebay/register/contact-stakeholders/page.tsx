import type { Metadata } from "next";
import { LearnEbayPracticeShell } from "@/features/learn-marketplace/components/LearnEbayPracticeShell";
import { LearnMarketplaceContactStakeholdersPage } from "@/features/learn-marketplace/components/LearnMarketplaceContactStakeholdersPage";

export const metadata: Metadata = {
  title: "Contact and stakeholders — Learn Marketplace",
};

export default function LearnMarketplaceContactStakeholdersRoute() {
  return (
    <LearnEbayPracticeShell>
      <LearnMarketplaceContactStakeholdersPage />
    </LearnEbayPracticeShell>
  );
}
