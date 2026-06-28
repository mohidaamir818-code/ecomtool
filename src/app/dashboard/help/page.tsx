import type { Metadata } from "next";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { SupportCenter } from "@/features/support/components/SupportCenter";

export const metadata: Metadata = {
  title: "Help Center — EcomTools",
};

export default function HelpPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[860px] p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-[#111827]">Help Center</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
          Need assistance with EcomTools? Send us a message with photos or a short video and our
          support team will reply right here.
        </p>

        <div className="mt-8">
          <SupportCenter />
        </div>
      </div>
    </DashboardLayout>
  );
}
