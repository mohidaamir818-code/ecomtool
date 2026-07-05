import type { Metadata } from "next";
import { LearnEbayPracticeShell } from "@/features/learn-marketplace/components/LearnEbayPracticeShell";
import { LearnMarketplacePhoneVerifyMethodPage } from "@/features/learn-marketplace/components/LearnMarketplacePhoneVerifyMethodPage";

export const metadata: Metadata = {
  title: "Verify phone method — Learn Marketplace",
};

export default function LearnMarketplacePhoneVerifyMethodRoute() {
  return (
    <LearnEbayPracticeShell>
      <LearnMarketplacePhoneVerifyMethodPage />
    </LearnEbayPracticeShell>
  );
}
