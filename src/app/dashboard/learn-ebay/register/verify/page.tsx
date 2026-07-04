import type { Metadata } from "next";
import { LearnEbayPracticeShell } from "@/features/learn-marketplace/components/LearnEbayPracticeShell";
import { LearnMarketplaceVerifyEmailPage } from "@/features/learn-marketplace/components/LearnMarketplaceVerifyEmailPage";

export const metadata: Metadata = {
  title: "Verify email — Learn Marketplace",
};

export default function LearnMarketplaceVerifyEmailRoute() {
  return (
    <LearnEbayPracticeShell>
      <LearnMarketplaceVerifyEmailPage />
    </LearnEbayPracticeShell>
  );
}
