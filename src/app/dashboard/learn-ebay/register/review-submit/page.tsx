import type { Metadata } from "next";
import { LearnEbayPracticeShell } from "@/features/learn-marketplace/components/LearnEbayPracticeShell";
import { LearnMarketplaceReviewSubmitPage } from "@/features/learn-marketplace/components/LearnMarketplaceReviewSubmitPage";

export const metadata: Metadata = {
  title: "Review and submit — Learn Marketplace",
};

export default function LearnMarketplaceReviewSubmitRoute() {
  return (
    <LearnEbayPracticeShell>
      <LearnMarketplaceReviewSubmitPage />
    </LearnEbayPracticeShell>
  );
}
