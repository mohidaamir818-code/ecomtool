"use client";

import Link from "next/link";
import { useState } from "react";

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

export function LearnMarketplaceSignInPage() {
  const [email, setEmail] = useState("");
  const [staySignedIn, setStaySignedIn] = useState(true);

  const canContinue = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <div className="flex min-h-full flex-col bg-white text-[#191919]">
      <header className="border-b border-gray-200">
        <div className="mx-auto max-w-[1200px] px-6 py-4">
          <MarketplaceLogo />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-6 py-12">
        <h1 className="text-center text-[2rem] font-bold tracking-tight">Sign in to your account</h1>

        <div className="mt-8 rounded-xl border border-gray-200 bg-[#f7f7f7] px-6 py-5 text-center">
          <p className="text-sm text-[#555]">New here?</p>
          <Link
            href="/dashboard/learn-ebay/register"
            className="mt-3 inline-flex rounded-full border-2 border-[#191919] bg-white px-6 py-2.5 text-sm font-semibold text-[#191919] transition hover:bg-gray-50"
          >
            Create account
          </Link>
        </div>

        <form
          className="mt-8 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <div>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email used for ecomtool sign in"
              autoComplete="email"
              className="w-full rounded-xl border border-[#767676] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:border-[#3665f3] focus:ring-2"
            />
          </div>

          <button
            type="submit"
            disabled={!canContinue}
            className={`w-full rounded-full px-6 py-3.5 text-sm font-semibold text-white transition ${
              canContinue
                ? "bg-[#3665f3] hover:bg-[#2f56cc]"
                : "cursor-not-allowed bg-[#9db3f3]"
            }`}
          >
            Continue
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-sm text-[#555]">or</span>
          </div>
        </div>

        <div className="space-y-3">
          {[
            {
              label: "Continue with Google",
              icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              ),
            },
            {
              label: "Continue with Apple",
              icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M16.365 1.43c0 1.14-.46 2.19-1.21 2.96-.83.86-2.02 1.38-3.18 1.3-.14-1.1.48-2.26 1.22-3.01.84-.84 2.28-1.41 3.17-1.25zM20.39 17.07c-.57 1.31-.85 1.9-1.58 3.06-1.03 1.62-2.48 3.64-4.28 3.65-1.6 0-2.02-1.04-4.2-1.03-2.18.01-2.64 1.05-4.24 1.04-1.79-.01-3.15-1.87-4.18-3.49-2.88-4.53-3.18-9.84-1.4-12.66 1.27-2.02 3.28-3.21 5.47-3.21 2.03 0 3.31 1.04 4.99 1.04 1.62 0 2.61-1.04 4.95-1.04 1.77 0 3.64.96 4.9 2.62-4.31 2.35-3.62 8.46.77 10.36-.3.74-.63 1.43-1 2.12z" />
                </svg>
              ),
            },
            {
              label: "Continue with Facebook",
              icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#1877F2" aria-hidden>
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              ),
            },
          ].map((provider) => (
            <button
              key={provider.label}
              type="button"
              className="flex w-full items-center justify-center gap-3 rounded-full border border-[#767676] bg-white px-4 py-3 text-sm font-semibold text-[#191919] transition hover:bg-gray-50"
            >
              <span className="flex w-5 justify-center">{provider.icon}</span>
              {provider.label}
            </button>
          ))}
        </div>

        <label className="mt-8 flex items-center justify-center gap-2 text-sm text-[#555]">
          <input
            type="checkbox"
            checked={staySignedIn}
            onChange={(event) => setStaySignedIn(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <span>Stay signed in</span>
          <button
            type="button"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#767676] text-[10px] text-[#767676]"
            aria-label="More information about stay signed in"
          >
            i
          </button>
        </label>
      </main>

      <footer className="border-t border-gray-200 px-6 py-6 text-center text-xs text-[#555]">
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
