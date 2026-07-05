"use client";

import Link from "next/link";

function EcomtoolLogo() {
  return (
    <Link href="/dashboard/learn-ebay" className="text-2xl font-bold tracking-tight text-[#3665f3]">
      ecomtool
    </Link>
  );
}

export function LearnMarketplaceRegisterCompletePage() {
  return (
    <div className="flex min-h-full flex-col bg-[#f7f7f7] text-[#191919]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[960px] items-center justify-between px-6 py-4">
          <EcomtoolLogo />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
          ✓
        </div>
        <h1 className="mt-6 text-[2rem] font-bold tracking-tight">Account setup complete</h1>
        <p className="mt-4 text-sm leading-relaxed text-[#555]">
          You have finished the marketplace registration practice. You can return to the marketplace
          homepage to keep exploring.
        </p>
        <Link
          href="/dashboard/learn-ebay"
          className="mt-8 inline-flex rounded-full bg-[#3665f3] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#2f56cc]"
        >
          Back to marketplace
        </Link>
      </main>

      <footer className="border-t border-gray-200 bg-white px-6 py-6 text-center text-xs text-[#555]">
        <p>Copyright © 1995-2026 ecomtool Inc. All Rights Reserved.</p>
      </footer>
    </div>
  );
}
