import type { Metadata } from "next";
import { LearnEbayPracticeShell } from "@/features/learn-marketplace/components/LearnEbayPracticeShell";
import { LearnMarketplaceRegisterCompletePage } from "@/features/learn-marketplace/components/LearnMarketplaceRegisterCompletePage";

export const metadata: Metadata = {
  title: "Registration complete — Learn Marketplace",
};

export default function LearnMarketplaceRegisterCompleteRoute() {
  return (
    <LearnEbayPracticeShell>
      <LearnMarketplaceRegisterCompletePage />
    </LearnEbayPracticeShell>
  );
}
