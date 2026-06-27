"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DashboardSidebar } from "./DashboardSidebar";
import { BlockedAccountBanner } from "./BlockedAccountBanner";
import { UserBlockProvider } from "@/features/dashboard/context/UserBlockContext";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState("User");
  const [userId, setUserId] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = sessionStorage.getItem("ecomtools_user_id");
    const emailVerified = sessionStorage.getItem("ecomtools_email_verified") === "true";
    const onboardingComplete =
      sessionStorage.getItem("ecomtools_onboarding_complete") === "true";

    if (!id) {
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
    setUserId(id);

    // Mirror to localStorage so the HuntPro connect page (opened in a separate
    // tab by the Chrome extension) can read the signed-in user's id.
    try {
      localStorage.setItem("ecomtools_user_id", id);
    } catch {
      // Ignore storage errors; the dashboard still works from sessionStorage.
    }

    const activeUserId = id;

    async function loadBlockStatus() {
      try {
        const response = await fetch(
          `/api/user/status?userId=${encodeURIComponent(activeUserId)}`,
        );
        if (response.ok) {
          const data = (await response.json()) as {
            blocked?: boolean;
            reason?: string | null;
          };
          setIsBlocked(Boolean(data.blocked));
          setBlockReason(data.reason ?? null);
        }
      } finally {
        setReady(true);
      }
    }

    void loadBlockStatus();
  }, [router]);

  const isHelpPage = pathname === "/dashboard/help" || pathname.startsWith("/dashboard/help/");

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
    <UserBlockProvider isBlocked={isBlocked} blockReason={blockReason}>
      <div className="flex min-h-screen bg-[#F9FAFB]">
        <DashboardSidebar userName={userName} plan="Free Plan" />
        <div className="flex flex-1 flex-col overflow-y-auto">
          <BlockedAccountBanner />
          <div className={isBlocked && !isHelpPage ? "pointer-events-none select-none opacity-60" : ""}>
            {children}
          </div>
        </div>
      </div>
    </UserBlockProvider>
  );
}
