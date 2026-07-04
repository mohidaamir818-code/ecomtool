import type { Metadata } from "next";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { LearnMarketplacePage } from "@/features/learn-marketplace/components/LearnMarketplacePage";

export const metadata: Metadata = {
  title: "Learn Marketplace — EcomTools",
};

export default function LearnEbayPage() {
  return (
    <DashboardLayout>
      <LearnMarketplacePage />
    </DashboardLayout>
  );
}
