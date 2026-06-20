"use client";

import { useEffect } from "react";
import { EBAY_BORDER, ebayPrimaryButtonClass } from "@/features/listings/lib/ebay-ui";
import { EbayLogo } from "./EbayLogo";

const BENEFITS = [
  "List products directly to eBay",
  "Auto sync prices and stock",
  "Manage all listings in one place",
  "AI-powered titles and descriptions",
];

interface EbayStoreConnectGateProps {
  userId: string;
  errorMessage?: string;
}

export function EbayStoreConnectGate({ userId, errorMessage }: EbayStoreConnectGateProps) {
  const authUrl = `/api/ebay/auth?userId=${encodeURIComponent(userId)}`;

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        window.location.reload();
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  return (
    <div className="mx-auto max-w-[480px] animate-[fadeIn_0.6s_ease-out] px-2 py-8">
      <div
        className="rounded-2xl border bg-white px-8 py-10 text-center shadow-lg"
        style={{ borderColor: EBAY_BORDER }}
      >
        <div className="flex justify-center">
          <EbayLogo className="h-10 w-auto" />
        </div>

        <h2 className="mt-6 text-2xl font-bold tracking-tight text-[#191919]">
          Connect Your eBay Store
        </h2>
        <p className="mt-2 text-base text-[#707070]">Start listing products in one click</p>

        <ul className="mt-8 space-y-3 text-left">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3 text-sm text-[#374151]">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              {benefit}
            </li>
          ))}
        </ul>

        {errorMessage ? (
          <div className="mt-6 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-left text-sm text-red-600">
            <p className="font-medium">Connection failed. Please try again.</p>
            <p className="mt-1">{errorMessage}</p>
          </div>
        ) : null}

        <a
          href={authUrl}
          className={`${ebayPrimaryButtonClass} mt-8 inline-flex w-full items-center justify-center px-8 py-3.5 text-base no-underline`}
        >
          Connect eBay Account
        </a>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[#707070]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
          Secure OAuth — we never store your eBay password
        </p>
      </div>
    </div>
  );
}
