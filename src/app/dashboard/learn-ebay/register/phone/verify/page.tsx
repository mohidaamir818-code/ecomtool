import type { Metadata } from "next";
import { LearnEbayPracticeShell } from "@/features/learn-marketplace/components/LearnEbayPracticeShell";
import { LearnMarketplacePhoneVerifyPage } from "@/features/learn-marketplace/components/LearnMarketplacePhoneVerifyPage";

export const metadata: Metadata = {
  title: "Verify phone — Learn Marketplace",
};

export default function LearnMarketplacePhoneVerifyRoute() {
  return (
    <LearnEbayPracticeShell>
      <LearnMarketplacePhoneVerifyPage />
    </LearnEbayPracticeShell>
  );
}
