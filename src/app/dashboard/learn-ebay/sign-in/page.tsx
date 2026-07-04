import type { Metadata } from "next";
import { LearnEbayPracticeShell } from "@/features/learn-marketplace/components/LearnEbayPracticeShell";
import { LearnMarketplaceSignInPage } from "@/features/learn-marketplace/components/LearnMarketplaceSignInPage";

export const metadata: Metadata = {
  title: "Sign in — Learn Marketplace",
};

export default function LearnMarketplaceSignInRoute() {
  return (
    <LearnEbayPracticeShell>
      <LearnMarketplaceSignInPage />
    </LearnEbayPracticeShell>
  );
}
