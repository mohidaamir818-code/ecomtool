"use client";

function formatSortCode(digits: string): string {
  if (digits.length !== 6) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
}

function BlurredValue({ children }: { children: string }) {
  return (
    <span className="inline-block select-none font-semibold text-[#191919] blur-[3px]">
      {children}
    </span>
  );
}

export function LearnMarketplacePayoutDoubleCheckCard({
  bankName,
  sortCode,
  accountNumber,
  authorisationChecked,
  onAuthorisationChange,
  onEdit,
  onContinue,
}: {
  bankName: string;
  sortCode: string;
  accountNumber: string;
  authorisationChecked: boolean;
  onAuthorisationChange: (checked: boolean) => void;
  onEdit: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="relative z-[70] mt-8 max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-bold text-[#191919]">Double-check your details</h2>
        <button
          type="button"
          onClick={onEdit}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#767676] transition hover:bg-gray-100 hover:text-[#191919]"
          aria-label="Edit bank details"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              d="M12 20h9M16.5 3.5a2.12 2.12 0 113 3L7 19l-4 1 1-4 12.5-12.5z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[#555]">
        We may deposit and withdraw £0.01 into your account within a few days to confirm your bank
        details. We&apos;ll follow up if there&apos;s anything you need to do.
      </p>

      <dl className="mt-6 space-y-4 border-t border-gray-100 pt-6">
        <div>
          <dt className="text-sm text-[#767676]">Bank or building society name</dt>
          <dd className="mt-1 text-sm">
            <BlurredValue>{bankName}</BlurredValue>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-[#767676]">Sort code</dt>
          <dd className="mt-1 text-sm">
            <BlurredValue>{formatSortCode(sortCode)}</BlurredValue>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-[#767676]">Bank or building society account number</dt>
          <dd className="mt-1 text-sm">
            <BlurredValue>{accountNumber}</BlurredValue>
          </dd>
        </div>
      </dl>

      <label className="mt-6 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={authorisationChecked}
          onChange={(event) => onAuthorisationChange(event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-[#3665f3] focus:ring-[#3665f3]"
        />
        <span className="text-sm leading-relaxed text-[#191919]">
          I am the account holder and sole person required to authorise debits on this account.
        </span>
      </label>

      <p className="mt-4 text-xs leading-relaxed text-[#555]">
        By clicking or tapping the button, you confirm the information is accurate and you authorise
        the respective marketplace entities to deduct amounts owed from your bank account.{" "}
        <button type="button" className="font-semibold text-[#3665f3] hover:underline">
          See Direct Debit mandate
        </button>
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-6">
        <div className="flex items-center gap-2 text-xs text-[#767676]">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 118 0v3" strokeLinecap="round" />
          </svg>
          Secure and private
        </div>
        <button
          type="button"
          disabled={!authorisationChecked}
          onClick={onContinue}
          className={`rounded-full px-10 py-3 text-sm font-semibold text-white transition ${
            authorisationChecked
              ? "bg-[#3665f3] hover:bg-[#2f56cc]"
              : "cursor-not-allowed bg-[#767676]"
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
