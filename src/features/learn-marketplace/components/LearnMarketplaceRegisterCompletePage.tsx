"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { resetPracticeRegistration } from "@/features/learn-marketplace/data/practice-registration-storage";

function MarketplaceLogo() {
  return (
    <Link href="/dashboard/learn-ebay" className="text-2xl font-bold tracking-tight">
      <span className="text-[#e53238]">m</span>
      <span className="text-[#0064d2]">a</span>
      <span className="text-[#f5af02]">r</span>
      <span className="text-[#86b817]">k</span>
      <span className="text-[#e53238]">e</span>
      <span className="text-[#0064d2]">t</span>
    </Link>
  );
}

export function LearnMarketplaceRegisterCompletePage() {
  const router = useRouter();

  function handlePracticeAgain() {
    resetPracticeRegistration();
    router.push("/dashboard/learn-ebay/register");
  }

  function handleMoveToNextStep() {
    router.push("/dashboard/learn-ebay");
  }

  return (
    <div className="flex min-h-full flex-col bg-[#f7f7f7] text-[#191919]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-[960px] px-6 py-4">
          <MarketplaceLogo />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
          ✓
        </div>
        <h1 className="mt-6 text-[2rem] font-bold tracking-tight">Practice submission complete</h1>
        <p className="mt-4 text-sm leading-relaxed text-[#555]">
          This is how you will create your seller account on the marketplace. The real sign-up pages
          may look a little different, but the steps and final submission work the same way.
        </p>

        <div className="mt-8 w-full max-w-md rounded-xl border border-[#3665f3]/20 bg-[#f0f6ff] px-5 py-4 text-left">
          <p className="text-sm font-semibold text-[#191919]">What you practiced</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[#555]">
            <li>Business details and company information</li>
            <li>Contact and stakeholder personal details</li>
            <li>Payout bank account linking and review</li>
            <li>Final review and submit</li>
          </ul>
        </div>

        <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={handlePracticeAgain}
            className="w-full rounded-full border-2 border-[#3665f3] bg-white px-8 py-3 text-sm font-semibold text-[#3665f3] transition hover:bg-[#f0f6ff] sm:w-auto"
          >
            Practice again
          </button>
          <button
            type="button"
            onClick={handleMoveToNextStep}
            className="w-full rounded-full bg-[#3665f3] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#2f56cc] sm:w-auto"
          >
            Move to the next step
          </button>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white px-6 py-6 text-center text-xs text-[#555]">
        <p>Copyright © 1995-2026 ecomtool Inc. All Rights Reserved.</p>
      </footer>
    </div>
  );
}
