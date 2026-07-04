import type { Metadata } from "next";
import { LearnEbayPracticeShell } from "@/features/learn-marketplace/components/LearnEbayPracticeShell";
import { LearnMarketplaceExperienceGate } from "@/features/learn-marketplace/components/LearnMarketplaceExperienceGate";
import { LearnMarketplacePage } from "@/features/learn-marketplace/components/LearnMarketplacePage";

export const metadata: Metadata = {
  title: "Learn Marketplace — EcomTools",
};

export default function LearnEbayPage() {
  return (
    <LearnEbayPracticeShell>
      <LearnMarketplaceExperienceGate>
        <LearnMarketplacePage />
      </LearnMarketplaceExperienceGate>
    </LearnEbayPracticeShell>
  );
}
