import type { Metadata } from "next";
import { LearnEbayPracticeShell } from "@/features/learn-marketplace/components/LearnEbayPracticeShell";
import { LearnMarketplacePage } from "@/features/learn-marketplace/components/LearnMarketplacePage";

export const metadata: Metadata = {
  title: "Learn Marketplace — EcomTools",
};

export default function LearnEbayPage() {
  return (
    <LearnEbayPracticeShell>
      <LearnMarketplacePage />
    </LearnEbayPracticeShell>
  );
}
