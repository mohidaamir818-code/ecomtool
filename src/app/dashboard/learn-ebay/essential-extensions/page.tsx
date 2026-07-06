import type { Metadata } from "next";
import { LearnEbayPracticeShell } from "@/features/learn-marketplace/components/LearnEbayPracticeShell";
import { LearnMarketplaceEssentialExtensionsPage } from "@/features/learn-marketplace/components/LearnMarketplaceEssentialExtensionsPage";

export const metadata: Metadata = {
  title: "Essential extensions — Learn Marketplace",
};

export default function LearnMarketplaceEssentialExtensionsRoute() {
  return (
    <LearnEbayPracticeShell>
      <LearnMarketplaceEssentialExtensionsPage />
    </LearnEbayPracticeShell>
  );
}
