"use client";

import { useRef } from "react";

function maskAccountHolderName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return `${trimmed.charAt(0)}****`;
}

function digitsOnly(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

export function LearnMarketplacePayoutManualEntryModal({
  visible,
  accountHolderName,
  onClose,
  onContinue,
  onSignInAnotherBank,
  nameInputRef,
  highlightName,
  onNameChange,
  sortCode,
  onSortCodeChange,
  accountNumber,
  onAccountNumberChange,
  confirmAccountNumber,
  onConfirmAccountNumberChange,
}: {
  visible: boolean;
  accountHolderName: string;
  onClose: () => void;
  onContinue: () => void;
  onSignInAnotherBank: () => void;
  nameInputRef?: React.RefObject<HTMLInputElement | null>;
  highlightName?: boolean;
  onNameChange: (value: string) => void;
  sortCode: string;
  onSortCodeChange: (value: string) => void;
  accountNumber: string;
  onAccountNumberChange: (value: string) => void;
  confirmAccountNumber: string;
  onConfirmAccountNumberChange: (value: string) => void;
}) {
  const localNameRef = useRef<HTMLInputElement>(null);
  const inputRef = nameInputRef ?? localNameRef;

  if (!visible) return null;

  const sortCodeDigits = sortCode.replace(/\D/g, "");
  const accountNumberValid = /^\d{8}$/.test(accountNumber);
  const accountsMatch = accountNumber.length > 0 && accountNumber === confirmAccountNumber;
  const canSubmit =
    accountHolderName.trim().length >= 2 &&
    sortCodeDigits.length === 6 &&
    accountNumberValid &&
    accountsMatch;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 px-4 py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-entry-title"
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="relative flex items-center justify-center border-b border-gray-200 px-4 py-4">
          <button
            type="button"
            onClick={onClose}
            className="absolute left-4 flex h-9 w-9 items-center justify-center rounded-full text-[#191919] hover:bg-gray-100"
            aria-label="Back"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h2 id="manual-entry-title" className="text-base font-semibold text-[#191919]">
            Manual Entry
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 flex h-9 w-9 items-center justify-center rounded-full text-[#191919] hover:bg-gray-100"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <h3 className="text-xl font-bold text-[#191919]">Enter your account details</h3>

          <div className="mt-6 space-y-5">
            <div className="relative z-[70]">
              <label htmlFor="manual-name-on-account" className="text-sm text-[#767676]">
                Name on account <span className="text-red-600">*</span>
              </label>
              <input
                ref={inputRef}
                id="manual-name-on-account"
                type="text"
                value={accountHolderName}
                placeholder={maskAccountHolderName(accountHolderName) || "M****"}
                onChange={(event) => onNameChange(event.target.value)}
                className={`mt-1 w-full rounded-lg border bg-white px-4 py-3.5 text-sm text-[#191919] outline-none transition focus:ring-2 ${
                  highlightName
                    ? "border-[#3665f3] ring-4 ring-[#3665f3]/20"
                    : "border-[#767676] focus:border-[#3665f3] focus:ring-[#3665f3]/20"
                }`}
              />
            </div>

            <div>
              <label htmlFor="manual-sort-code" className="text-sm text-[#767676]">
                Sort code <span className="text-red-600">*</span>
              </label>
              <input
                id="manual-sort-code"
                type="text"
                inputMode="numeric"
                value={sortCode}
                onChange={(event) => onSortCodeChange(digitsOnly(event.target.value, 6))}
                className="mt-1 w-full rounded-lg border border-[#767676] bg-white px-4 py-3.5 text-sm outline-none focus:border-[#3665f3] focus:ring-2 focus:ring-[#3665f3]/20"
              />
            </div>

            <div>
              <label htmlFor="manual-account-number" className="text-sm text-[#767676]">
                Account number <span className="text-red-600">*</span>
              </label>
              <input
                id="manual-account-number"
                type="text"
                inputMode="numeric"
                value={accountNumber}
                onChange={(event) => onAccountNumberChange(digitsOnly(event.target.value, 8))}
                className="mt-1 w-full rounded-lg border border-[#767676] bg-white px-4 py-3.5 text-sm outline-none focus:border-[#3665f3] focus:ring-2 focus:ring-[#3665f3]/20"
              />
            </div>

            <div>
              <label htmlFor="manual-confirm-account-number" className="text-sm text-[#767676]">
                Re-enter account number <span className="text-red-600">*</span>
              </label>
              <input
                id="manual-confirm-account-number"
                type="text"
                inputMode="numeric"
                value={confirmAccountNumber}
                onChange={(event) => onConfirmAccountNumberChange(digitsOnly(event.target.value, 8))}
                className="mt-1 w-full rounded-lg border border-[#767676] bg-white px-4 py-3.5 text-sm outline-none focus:border-[#3665f3] focus:ring-2 focus:ring-[#3665f3]/20"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={!canSubmit}
            onClick={onContinue}
            className={`mt-8 w-full rounded-full py-3.5 text-sm font-semibold text-white transition ${
              canSubmit ? "bg-[#3665f3] hover:bg-[#2f56cc]" : "cursor-not-allowed bg-[#767676]"
            }`}
          >
            Continue
          </button>

          <button
            type="button"
            onClick={onSignInAnotherBank}
            className="mt-3 w-full rounded-full border-2 border-[#3665f3] bg-white py-3.5 text-sm font-semibold text-[#3665f3] transition hover:bg-[#f0f6ff]"
          >
            Sign in to another bank
          </button>
        </div>

        <div className="border-t border-gray-100 px-6 py-4 text-center">
          <p className="text-xs text-[#767676]">
            Secure connection via{" "}
            <span className="font-bold tracking-wide text-[#0ebd69]">Trustly</span>
          </p>
        </div>
      </div>
    </div>
  );
}
