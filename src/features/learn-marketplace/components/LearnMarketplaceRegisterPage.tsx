"use client";

import Link from "next/link";
import { useState } from "react";

type AccountType = "private" | "business";

const countries = [
  "United Kingdom",
  "United States",
  "Germany",
  "France",
  "Italy",
  "Spain",
  "Netherlands",
  "Ireland",
  "Canada",
  "Australia",
];

function MarketplaceLogo() {
  return (
    <Link href="/dashboard/learn-ebay" className="text-3xl font-bold tracking-tight">
      <span className="text-[#e53238]">m</span>
      <span className="text-[#0064d2]">a</span>
      <span className="text-[#f5af02]">r</span>
      <span className="text-[#86b817]">k</span>
      <span className="text-[#e53238]">e</span>
      <span className="text-[#0064d2]">t</span>
    </Link>
  );
}

export function LearnMarketplaceRegisterPage() {
  const [accountType, setAccountType] = useState<AccountType>("business");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-full flex-col bg-white text-[#191919]">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <MarketplaceLogo />
          <p className="text-sm text-[#555]">
            Already have an account?{" "}
            <Link href="/dashboard/learn-ebay" className="font-semibold text-[#3665f3] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-10 px-6 py-10 lg:flex-row lg:gap-16">
        <div className="lg:w-[42%]">
          <div className="overflow-hidden rounded-2xl bg-[#f0f0f0]">
            <img
              src="https://picsum.photos/id/628/640/820"
              alt=""
              referrerPolicy="no-referrer"
              className="h-full min-h-[320px] w-full object-cover lg:min-h-[640px]"
              onError={(event) => {
                event.currentTarget.src = "https://picsum.photos/seed/marketplace-register/640/820";
              }}
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col lg:max-w-[520px]">
          <h1 className="text-[2rem] font-bold tracking-tight">Create an account</h1>

          <div className="mt-6 flex overflow-hidden rounded-full border border-[#191919] p-0.5 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setAccountType("private")}
              className={`flex-1 rounded-full px-4 py-2.5 transition ${
                accountType === "private"
                  ? "bg-[#191919] text-white"
                  : "bg-white text-[#191919] hover:bg-gray-50"
              }`}
            >
              Private
            </button>
            <button
              type="button"
              onClick={() => setAccountType("business")}
              className={`flex-1 rounded-full px-4 py-2.5 transition ${
                accountType === "business"
                  ? "bg-[#191919] text-white"
                  : "bg-white text-[#191919] hover:bg-gray-50"
              }`}
            >
              Business
            </button>
          </div>

          {accountType === "business" ? (
            <p className="mt-4 text-sm leading-relaxed text-[#555]">
              Continue to register as a business or nonprofit, or if you plan to sell a large number of goods.
            </p>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-[#555]">
              Create a personal account to buy, sell, and manage your orders.
            </p>
          )}

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            {accountType === "business" ? (
              <input
                type="text"
                placeholder="Business name"
                className="w-full rounded-xl bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
              />
            ) : (
              <>
                <input
                  type="text"
                  placeholder="First name"
                  className="w-full rounded-xl bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
                />
                <input
                  type="text"
                  placeholder="Last name"
                  className="w-full rounded-xl bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
                />
              </>
            )}

            <input
              type="email"
              placeholder={accountType === "business" ? "Business email" : "Email"}
              className="w-full rounded-xl bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
            />

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className="w-full rounded-xl bg-[#f7f7f7] px-4 py-3.5 pr-12 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-[#555] hover:text-[#191919]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3l18 18M10.58 10.58A2 2 0 0012 15a2 2 0 002.42-2.42M9.88 4.24A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 7.5a11.8 11.8 0 01-4.24 5.11M6.11 6.11A11.8 11.8 0 003 12.5C4.73 15.89 8.99 19 14 19c1.01 0 1.98-.13 2.88-.36" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 12.5C3.73 8.11 8 5 13 5s9.27 3.11 11 7.5c-1.73 4.39-6 7.5-11 7.5S3.73 16.89 2 12.5z" />
                    <circle cx="13" cy="12.5" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {accountType === "business" ? (
              <>
                <select
                  defaultValue=""
                  className="w-full appearance-none rounded-xl bg-[#f7f7f7] px-4 py-3.5 text-sm text-[#555] outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
                >
                  <option value="" disabled>
                    Where is your business registered?
                  </option>
                  {countries.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-relaxed text-[#555]">
                  If your business isn&apos;t registered, select your country of residence.
                </p>
              </>
            ) : (
              <select
                defaultValue=""
                className="w-full appearance-none rounded-xl bg-[#f7f7f7] px-4 py-3.5 text-sm text-[#555] outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
              >
                <option value="" disabled>
                  Where do you live?
                </option>
                {countries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            )}

            <label className="flex items-start gap-3 pt-1 text-sm text-[#191919]">
              <input type="checkbox" className="mt-1 h-4 w-4 rounded border-gray-300" />
              <span>I&apos;m only interested in buying for now</span>
            </label>

            <p className="text-xs leading-relaxed text-[#555]">
              We&apos;ll regularly send you emails with offers regarding our services. You can unsubscribe at any time.
            </p>

            <p className="text-xs leading-relaxed text-[#555]">
              By selecting{" "}
              {accountType === "business" ? "Create business account" : "Create account"}, you agree to our{" "}
              <button type="button" className="text-[#3665f3] hover:underline">
                User Agreement
              </button>{" "}
              and acknowledge reading our{" "}
              <button type="button" className="text-[#3665f3] hover:underline">
                User Privacy Notice
              </button>
              .
            </p>

            <button
              type="submit"
              className="w-full rounded-full bg-[#767676] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#5c5c5c]"
            >
              {accountType === "business" ? "Create business account" : "Create account"}
            </button>
          </form>

          <button
            type="button"
            className="mt-auto self-end pt-8 text-[#767676]"
            aria-label="Help"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.5 9.5a2.5 2.5 0 115 0c0 2-2.5 1.75-2.5 4M12 17h.01" />
            </svg>
          </button>
        </div>
      </main>

      <footer className="border-t border-gray-200 px-6 py-6 text-center text-xs text-[#555]">
        <p>Copyright © 1995-2026 Marketplace Inc. All Rights Reserved.</p>
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
