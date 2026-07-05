import type { Metadata } from "next";
import { LearnEbayPracticeShell } from "@/features/learn-marketplace/components/LearnEbayPracticeShell";
import { LearnMarketplaceUsernamePage } from "@/features/learn-marketplace/components/LearnMarketplaceUsernamePage";

export const metadata: Metadata = {
  title: "Create username — Learn Marketplace",
};

export default function LearnMarketplaceUsernameRoute() {
  return (
    <LearnEbayPracticeShell>
      <LearnMarketplaceUsernamePage />
    </LearnEbayPracticeShell>
  );
}
