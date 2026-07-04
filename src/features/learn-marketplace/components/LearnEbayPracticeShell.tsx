"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface LearnEbayPracticeShellProps {
  children: React.ReactNode;
}

export function LearnEbayPracticeShell({ children }: LearnEbayPracticeShellProps) {
  const router = useRouter();
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

    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
        <svg
          className="h-8 w-8 animate-spin text-[#3665f3]"
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
    <div className="min-h-screen bg-[#f7f7f7]">
      <div className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-2.5">
          <p className="text-sm text-[#555]">
            Practice mode — explore the marketplace layout
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-[#3665f3] bg-white px-4 py-2 text-sm font-semibold text-[#3665f3] transition hover:bg-[#3665f3] hover:text-white"
          >
            ← Leave practice
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
