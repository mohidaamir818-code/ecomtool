import type { Metadata } from "next";
import { SettingsShell } from "@/features/dashboard/components/SettingsShell";

export const metadata: Metadata = {
  title: "Settings — EcomTools",
  description: "Manage cache, sync, and usage preferences.",
};

export default function DashboardSettingsPage() {
  return <SettingsShell />;
}
