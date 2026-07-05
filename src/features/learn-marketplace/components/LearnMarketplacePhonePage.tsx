"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  DEFAULT_MARKETPLACE_PHONE_COUNTRY,
  MARKETPLACE_PHONE_COUNTRIES,
  marketplaceCountryFlag,
} from "@/features/learn-marketplace/data/marketplace-phone-countries";

const PRACTICE_PHONE_KEY = "learn_marketplace_practice_phone";

function EcomtoolLogo() {
  return (
    <Link href="/dashboard/learn-ebay" className="text-2xl font-bold tracking-tight text-[#3665f3]">
      ecomtool
    </Link>
  );
}

export function LearnMarketplacePhonePage() {
  const router = useRouter();
  const [selectedIso, setSelectedIso] = useState(DEFAULT_MARKETPLACE_PHONE_COUNTRY.iso);
  const [phoneNumber, setPhoneNumber] = useState("");

  const selectedCountry = useMemo(
    () =>
      MARKETPLACE_PHONE_COUNTRIES.find((country) => country.iso === selectedIso) ??
      DEFAULT_MARKETPLACE_PHONE_COUNTRY,
    [selectedIso],
  );

  const canContinue = phoneNumber.replace(/\D/g, "").length >= 6;

  return (
    <div className="flex min-h-full flex-col bg-[#f7f7f7] text-[#191919]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[960px] items-center justify-between px-6 py-4">
          <EcomtoolLogo />
          <button type="button" className="text-sm text-[#3665f3] hover:underline">
            Tell us what you think
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[760px] flex-1 px-6 py-12">
        <div className="w-full rounded-xl border border-gray-200 bg-white px-8 py-10 shadow-sm">
          <h1 className="text-[2rem] font-bold tracking-tight">Add your phone number</h1>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#555]">
            We&apos;ll text a security code to your mobile phone to finish setting up your account.
          </p>

          <div className="mt-8 overflow-hidden rounded-xl border border-[#767676] bg-white">
            <div className="flex">
              <div className="relative flex shrink-0 items-center border-r border-[#767676] bg-white">
                <span className="pointer-events-none pl-4 text-xl" aria-hidden>
                  {marketplaceCountryFlag(selectedCountry.iso)}
                </span>
                <select
                  value={selectedIso}
                  onChange={(event) => setSelectedIso(event.target.value)}
                  className="h-16 min-w-[72px] cursor-pointer appearance-none bg-transparent pl-2 pr-8 text-sm outline-none"
                  aria-label="Country code"
                >
                  {MARKETPLACE_PHONE_COUNTRIES.map((country) => (
                    <option key={country.iso} value={country.iso}>
                      {country.name} ({country.dialCode})
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2 text-xs text-[#555]" aria-hidden>
                  ▾
                </span>
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
                <label htmlFor="practice-phone-number" className="text-xs text-[#767676]">
                  Phone number
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm font-medium text-[#191919]">{selectedCountry.dialCode}</span>
                  <input
                    id="practice-phone-number"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value.replace(/[^\d\s()-]/g, ""))}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    placeholder=""
                  />
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 max-w-xl text-xs leading-relaxed text-[#555]">
            By selecting Continue, you agree to receive a text message with a security code. Standard rates
            may apply. This number will be saved to your account.
          </p>

          <div className="mt-10 flex justify-end">
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => {
                sessionStorage.setItem(
                  PRACTICE_PHONE_KEY,
                  `${selectedCountry.dialCode} ${phoneNumber.trim()}`,
                );
                router.push("/dashboard/learn-ebay/register/phone/verify-method");
              }}
              className={`rounded-full px-10 py-3 text-sm font-semibold text-white transition ${
                canContinue
                  ? "bg-[#3665f3] hover:bg-[#2f56cc]"
                  : "cursor-not-allowed bg-[#767676]"
              }`}
            >
              Continue
            </button>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white px-6 py-6 text-center text-xs text-[#555]">
        <p>Copyright © 1995-2026 ecomtool Inc. All Rights Reserved.</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {["User Agreement", "Privacy", "Payments Terms of Use", "Cookies", "AdChoice"].map((link) => (
            <button key={link} type="button" className="hover:underline">
              {link}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
