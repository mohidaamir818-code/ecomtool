import type { Metadata } from "next";
import { LearnEbayPracticeShell } from "@/features/learn-marketplace/components/LearnEbayPracticeShell";
import { LearnMarketplaceIpSignInPage } from "@/features/learn-marketplace/components/LearnMarketplaceIpSignInPage";

export const metadata: Metadata = {
  title: "Sign in to IPBurger — Learn Marketplace",
};

export default function LearnMarketplaceIpSignInRoute() {
  return (
    <LearnEbayPracticeShell>
      <LearnMarketplaceIpSignInPage />
    </LearnEbayPracticeShell>
  );
}
