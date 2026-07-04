import type { Metadata } from "next";
import { LearnEbayPracticeShell } from "@/features/learn-marketplace/components/LearnEbayPracticeShell";
import { LearnMarketplacePhonePage } from "@/features/learn-marketplace/components/LearnMarketplacePhonePage";

export const metadata: Metadata = {
  title: "Add phone number — Learn Marketplace",
};

export default function LearnMarketplacePhoneRoute() {
  return (
    <LearnEbayPracticeShell>
      <LearnMarketplacePhonePage />
    </LearnEbayPracticeShell>
  );
}
