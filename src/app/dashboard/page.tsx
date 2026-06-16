import type { Metadata } from "next";
import { DashboardShell } from "@/features/dashboard/components/DashboardShell";

export const metadata: Metadata = {
  title: "Dashboard — EcomTools",
  description: "Overview of your account activity and usage.",
};

export default function DashboardPage() {
  return <DashboardShell />;
}
