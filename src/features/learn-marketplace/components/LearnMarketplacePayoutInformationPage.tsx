"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LearnMarketplaceAnimatedCursor } from "@/features/learn-marketplace/components/LearnMarketplaceAnimatedCursor";
import { PRACTICE_BUSINESS_DETAILS_DONE_KEY } from "@/features/learn-marketplace/components/LearnMarketplaceContactStakeholdersGuide";
import { PRACTICE_REGISTERED_SUBTYPE_KEY } from "@/features/learn-marketplace/components/LearnMarketplaceBusinessTypeGuide";
import { LearnMarketplacePayoutDoubleCheckCard } from "@/features/learn-marketplace/components/LearnMarketplacePayoutDoubleCheckCard";
import { LearnMarketplacePayoutManualEntryModal } from "@/features/learn-marketplace/components/LearnMarketplacePayoutManualEntryModal";
import {
  LearnMarketplacePayoutInformationGuide,
  PAYOUT_INFORMATION_CURSOR_KEY_PREFIX,
  PAYOUT_INFORMATION_GUIDE_KEY,
  PRACTICE_CONTACT_STAKEHOLDERS_DONE_KEY,
} from "@/features/learn-marketplace/components/LearnMarketplacePayoutInformationGuide";
import {
  PRACTICE_PAYOUT_DONE_KEY,
  savePracticePayoutDetails,
} from "@/features/learn-marketplace/data/practice-registration-storage";
import { PRACTICE_USERNAME_KEY } from "@/features/learn-marketplace/components/LearnMarketplaceUsernameGuide";

const signupSteps = [
  { label: "Business details", status: "done" as const },
  { label: "Contact and stakeholders", status: "done" as const },
  { label: "Payout information", status: "current" as const },
  { label: "Review and submit", status: "upcoming" as const },
];

const UK_BANKS = [
  { id: "rbs", name: "Royal Bank of Scotland", abbr: "RBS", bg: "#0033a0", text: "#ffffff" },
  { id: "lloyds", name: "Lloyds Bank", abbr: "LLOYDS", bg: "#006a4d", text: "#ffffff" },
  { id: "halifax", name: "Halifax", abbr: "Halifax", bg: "#004a97", text: "#ffffff" },
  { id: "natwest", name: "NatWest", abbr: "NatWest", bg: "#5c0330", text: "#ffffff" },
  { id: "barclays", name: "Barclays", abbr: "Barclays", bg: "#00aeef", text: "#00395d" },
  { id: "hsbc", name: "HSBC UK", abbr: "HSBC", bg: "#db0011", text: "#ffffff" },
  { id: "santander", name: "Santander UK", abbr: "Santander", bg: "#ec0000", text: "#ffffff" },
  { id: "tsb", name: "TSB", abbr: "TSB", bg: "#002f6c", text: "#ffffff" },
] as const;

const DEFAULT_ACCOUNT_HOLDER = "Merivonco Ltd";

function maskAccountHolderName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return `${trimmed.charAt(0)}****`;
}

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

function cursorGuideStorageKey(userId: string) {
  return `${PAYOUT_INFORMATION_CURSOR_KEY_PREFIX}${userId}`;
}

function BankBuildingIcon() {
  return (
    <svg className="h-8 w-8 text-[#767676]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 10h18M5 10V19M9 10V19M15 10V19M19 10V19M2 19h20M12 3l9 5H3l9-5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LearnMarketplacePayoutInformationPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const accountNameRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [showIntroPopup, setShowIntroPopup] = useState(false);
  const [showCursor, setShowCursor] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showDoubleCheck, setShowDoubleCheck] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [savedBankName, setSavedBankName] = useState("");
  const [authorisationChecked, setAuthorisationChecked] = useState(false);

  const [accountHolderName, setAccountHolderName] = useState(DEFAULT_ACCOUNT_HOLDER);
  const [manualAccountName, setManualAccountName] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");

  useEffect(() => {
    const username = sessionStorage.getItem(PRACTICE_USERNAME_KEY);
    const subtype = sessionStorage.getItem(PRACTICE_REGISTERED_SUBTYPE_KEY);
    const businessDetailsDone =
      sessionStorage.getItem(PRACTICE_BUSINESS_DETAILS_DONE_KEY) === "true";
    const contactDone =
      sessionStorage.getItem(PRACTICE_CONTACT_STAKEHOLDERS_DONE_KEY) === "true";

    if (!username || subtype !== "company" || !businessDetailsDone || !contactDone) {
      router.replace("/dashboard/learn-ebay/register/contact-stakeholders");
      return;
    }

    setShowIntroPopup(sessionStorage.getItem(PAYOUT_INFORMATION_GUIDE_KEY) !== "true");
    setReady(true);
  }, [router]);

  const openManualEntry = useCallback(
    (bankId: string | null, forEdit = false) => {
      setSelectedBankId(bankId);
      if (!forEdit) {
        setManualAccountName(maskAccountHolderName(accountHolderName));
      }
      setShowManualEntry(true);
    },
    [accountHolderName],
  );

  function handleManualEntryContinue() {
    const bankName =
      selectedBankId != null
        ? (UK_BANKS.find((bank) => bank.id === selectedBankId)?.name ?? "Other")
        : "Other";
    setSavedBankName(bankName);
    setAuthorisationChecked(false);
    setShowManualEntry(false);
    setShowDoubleCheck(true);
    completeCursorGuide();
  }

  function handleEditBankDetails() {
    openManualEntry(selectedBankId, true);
  }

  const startCursorGuide = useCallback(() => {
    setShowCursor(true);
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!ready || showIntroPopup || showDoubleCheck) return;

    const userId = sessionStorage.getItem("ecomtools_user_id");
    const cursorSeen =
      userId != null && localStorage.getItem(cursorGuideStorageKey(userId)) === "true";
    if (!cursorSeen) {
      startCursorGuide();
    }
  }, [ready, showIntroPopup, showDoubleCheck, startCursorGuide]);

  function completeCursorGuide() {
    const userId = sessionStorage.getItem("ecomtools_user_id");
    if (userId) {
      localStorage.setItem(cursorGuideStorageKey(userId), "true");
    }
    setShowCursor(false);
  }

  function closeManualEntry() {
    setShowManualEntry(false);
    setSelectedBankId(null);
  }

  const searchQuery = bankSearch.trim();
  const searchUpper = searchQuery.toUpperCase();
  const showOtherEntry = searchUpper === "OTHER";
  const filteredBanks =
    searchQuery.length === 0
      ? UK_BANKS
      : UK_BANKS.filter((bank) => bank.name.toUpperCase().includes(searchUpper));

  if (!ready) {
    return (
      <div className="flex min-h-full items-center justify-center bg-white">
        <svg className="h-8 w-8 animate-spin text-[#3665f3]" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-white text-[#191919]">
      <LearnMarketplacePayoutInformationGuide
        visible={showIntroPopup}
        onDismiss={() => setShowIntroPopup(false)}
      />

      <LearnMarketplacePayoutManualEntryModal
        visible={showManualEntry}
        accountHolderName={manualAccountName}
        onClose={closeManualEntry}
        onSignInAnotherBank={closeManualEntry}
        nameInputRef={accountNameRef}
        highlightName={showCursor && showManualEntry}
        onNameChange={(value) => {
          setManualAccountName(value);
          if (showCursor && value.trim()) {
            completeCursorGuide();
          }
        }}
        sortCode={sortCode}
        onSortCodeChange={setSortCode}
        accountNumber={accountNumber}
        onAccountNumberChange={setAccountNumber}
        confirmAccountNumber={confirmAccountNumber}
        onConfirmAccountNumberChange={setConfirmAccountNumber}
        onContinue={handleManualEntryContinue}
      />

      <style jsx global>{`
        @keyframes learn-cursor-wiggle {
          0%,
          100% {
            transform: translate(0, 0) rotate(-8deg);
          }
          25% {
            transform: translate(6px, 4px) rotate(-2deg);
          }
          50% {
            transform: translate(2px, 8px) rotate(-12deg);
          }
          75% {
            transform: translate(8px, 2px) rotate(-4deg);
          }
        }
      `}</style>

      <header className="border-b border-gray-200">
        <div className="mx-auto max-w-[1200px] px-6 py-4">
          <MarketplaceLogo />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1200px] flex-1 gap-10 px-6 py-10">
        <aside className="hidden w-[240px] shrink-0 lg:block">
          <p className="text-lg font-bold">New seller sign-up</p>
          <ol className="mt-8 space-y-5">
            {signupSteps.map((step, index) => (
              <li key={step.label} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                    step.status === "done"
                      ? "border-[#3665f3] bg-[#3665f3] text-white"
                      : step.status === "current"
                        ? "border-[#3665f3] text-[#3665f3]"
                        : "border-gray-300 text-[#767676]"
                  }`}
                >
                  {step.status === "done" ? "✓" : index + 1}
                </span>
                <span
                  className={
                    step.status === "current"
                      ? "font-semibold text-[#191919]"
                      : step.status === "done"
                        ? "text-[#191919]"
                        : "text-[#767676]"
                  }
                >
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-10 border-t border-gray-200 pt-6 text-sm text-[#555]">
            <p>
              <span className="font-semibold text-[#191919]">Business type:</span> Company
            </p>
            <p className="mt-2">
              <span className="font-semibold text-[#191919]">Business location:</span> United Kingdom
            </p>
            <button type="button" className="mt-3 text-[#3665f3] hover:underline">
              Edit
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 pb-24">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>
              👛
            </span>
            <h1 className="text-[2rem] font-bold tracking-tight">Payout information</h1>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#555]">
            Link a bank account so you can get paid. We also need this info so we can debit any amounts
            you owe, confirm your identity and comply with applicable regulations.{" "}
            <button type="button" className="font-semibold text-[#3665f3] hover:underline">
              Learn more
            </button>
          </p>

          {showDoubleCheck ? (
            <LearnMarketplacePayoutDoubleCheckCard
              bankName={savedBankName}
              sortCode={sortCode}
              accountNumber={accountNumber}
              authorisationChecked={authorisationChecked}
              onAuthorisationChange={setAuthorisationChecked}
              onEdit={handleEditBankDetails}
              onContinue={() => {
                if (!authorisationChecked) return;
                savePracticePayoutDetails({
                  accountHolderName: manualAccountName,
                  bankName: savedBankName,
                  sortCode,
                  accountNumber,
                });
                sessionStorage.setItem(PRACTICE_PAYOUT_DONE_KEY, "true");
                router.push("/dashboard/learn-ebay/register/review-submit");
              }}
            />
          ) : (
          <div className="relative z-[70] mt-8 max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="text-[#767676]">Account holder name</span>
              <span className="font-bold text-[#191919]">{accountHolderName}</span>
            </div>

            <div className="relative mt-5">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#767676]">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
                </svg>
              </span>
              <input
                ref={searchRef}
                type="text"
                value={bankSearch}
                onChange={(event) => {
                  setBankSearch(event.target.value);
                  if (showCursor && event.target.value.trim()) {
                    completeCursorGuide();
                  }
                }}
                placeholder="Search for your bank"
                className={`w-full rounded-lg border bg-white py-3.5 pl-12 pr-10 text-sm outline-none transition focus:ring-2 ${
                  showCursor && !showManualEntry
                    ? "border-[#3665f3] ring-4 ring-[#3665f3]/20"
                    : "border-[#191919] focus:border-[#3665f3] focus:ring-[#3665f3]/20"
                }`}
              />
              {bankSearch ? (
                <button
                  type="button"
                  onClick={() => setBankSearch("")}
                  className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#767676] hover:bg-gray-100"
                  aria-label="Clear search"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              ) : null}
            </div>

            {showOtherEntry ? (
              <button
                type="button"
                onClick={() => openManualEntry(null)}
                className="mt-3 flex w-full items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-[#3665f3] hover:bg-[#f7f7f7]"
              >
                <BankBuildingIcon />
                <span>
                  <span className="block text-xs text-[#767676]">Can&apos;t find your bank?</span>
                  <span className="block text-sm font-bold text-[#191919]">Enter account details</span>
                </span>
              </button>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {filteredBanks.map((bank) => (
                  <button
                    key={bank.id}
                    type="button"
                    onClick={() => openManualEntry(bank.id)}
                    className={`flex min-h-[72px] flex-col items-center justify-center rounded-lg border px-2 py-3 text-center transition hover:border-[#3665f3] hover:shadow-sm ${
                      selectedBankId === bank.id && showManualEntry
                        ? "border-[#3665f3] ring-2 ring-[#3665f3]/20"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <span
                      className="flex h-10 w-full items-center justify-center rounded px-1 text-[10px] font-bold leading-tight sm:text-xs"
                      style={{ backgroundColor: bank.bg, color: bank.text }}
                    >
                      {bank.abbr}
                    </span>
                    <span className="mt-2 line-clamp-2 text-[10px] font-medium text-[#555] sm:text-xs">
                      {bank.name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6 flex items-center gap-2 text-xs text-[#767676]">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 118 0v3" strokeLinecap="round" />
              </svg>
              Secure and private
            </div>
          </div>
          )}
        </div>
      </main>

      <LearnMarketplaceAnimatedCursor
        targetRef={showManualEntry ? accountNameRef : searchRef}
        visible={showCursor}
      />

      {showCursor && !showManualEntry ? (
        <div className="pointer-events-none fixed inset-0 z-[60] bg-black/20" aria-hidden />
      ) : null}

      <button
        type="button"
        onClick={() => {
          sessionStorage.removeItem(PAYOUT_INFORMATION_GUIDE_KEY);
          setShowIntroPopup(true);
        }}
        className="fixed bottom-20 right-6 z-[90] inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-[#555] shadow-lg transition hover:bg-gray-50"
      >
        Show payout guide
      </button>

      <button
        type="button"
        onClick={startCursorGuide}
        className="fixed bottom-6 right-6 z-[90] inline-flex items-center gap-2 rounded-full border border-[#3665f3] bg-white px-4 py-2.5 text-sm font-semibold text-[#3665f3] shadow-lg transition hover:bg-[#3665f3] hover:text-white"
        aria-label="Show cursor guide again"
      >
        <span aria-hidden>🖱️</span>
        Cursor guide
      </button>
    </div>
  );
}
