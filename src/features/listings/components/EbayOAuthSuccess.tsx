"use client";

import { useEffect } from "react";

interface EbayOAuthSuccessProps {
  onComplete: () => void;
}

export function EbayOAuthSuccess({ onComplete }: EbayOAuthSuccessProps) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, 2500);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="mx-auto flex max-w-[480px] animate-[fadeIn_0.6s_ease-out] flex-col items-center px-4 py-16 text-center">
      <div className="flex h-20 w-20 animate-[scaleIn_0.5s_ease-out] items-center justify-center rounded-full bg-emerald-50">
        <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-emerald-600" aria-hidden>
          <path
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
      <h2 className="mt-6 text-2xl font-bold text-[#191919]">Successfully connected!</h2>
      <p className="mt-2 animate-pulse text-base text-[#707070]">Loading your store...</p>
    </div>
  );
}
