import type { Metadata } from "next";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";

export const metadata: Metadata = {
  title: "Help Center — EcomTools",
};

export default function HelpPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[720px] p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-[#111827]">Help Center</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
          Need assistance with EcomTools? Contact our support team and we will get back to you
          as soon as possible.
        </p>

        <div className="mt-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-[#111827]">Contact support</h2>
          <p className="mt-2 text-sm text-[#6B7280]">
            Email us at{" "}
            <a href="mailto:support@ecomtool.com" className="font-medium text-brand hover:underline">
              support@ecomtool.com
            </a>{" "}
            with your account email and a description of your issue.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
