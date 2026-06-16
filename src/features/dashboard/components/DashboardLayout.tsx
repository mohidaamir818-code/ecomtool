"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "./DashboardSidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const [userName, setUserName] = useState("User");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const userId = sessionStorage.getItem("ecomtools_user_id");
    const emailVerified = sessionStorage.getItem("ecomtools_email_verified") === "true";
    const onboardingComplete =
      sessionStorage.getItem("ecomtools_onboarding_complete") === "true";

    if (!userId) {
      router.replace("/sign-up");
      return;
    }
    if (!emailVerified) {
      router.replace("/verify-email");
      return;
    }
    if (!onboardingComplete) {
      router.replace("/onboarding");
      return;
    }

    const name = sessionStorage.getItem("ecomtools_user_name");
    if (name) setUserName(name);
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB]">
        <svg
          className="h-8 w-8 animate-spin text-brand"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <DashboardSidebar userName={userName} plan="Free Plan" />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
