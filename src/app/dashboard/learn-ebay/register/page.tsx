import type { Metadata } from "next";
import { LearnEbayPracticeShell } from "@/features/learn-marketplace/components/LearnEbayPracticeShell";
import { LearnMarketplaceRegisterPage } from "@/features/learn-marketplace/components/LearnMarketplaceRegisterPage";

export const metadata: Metadata = {
  title: "Create account — Learn Marketplace",
};

export default function LearnMarketplaceRegisterRoute() {
  return (
    <LearnEbayPracticeShell>
      <LearnMarketplaceRegisterPage />
    </LearnEbayPracticeShell>
  );
}
