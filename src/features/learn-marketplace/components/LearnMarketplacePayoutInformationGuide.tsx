"use client";

export const PAYOUT_INFORMATION_GUIDE_KEY = "learn_marketplace_payout_information_guide_ack";
export const PAYOUT_INFORMATION_CURSOR_KEY_PREFIX =
  "learn_marketplace_payout_information_cursor_";
export const PRACTICE_CONTACT_STAKEHOLDERS_DONE_KEY =
  "learn_marketplace_practice_contact_stakeholders_done";

export function LearnMarketplacePayoutInformationGuide({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payout-information-guide-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl"
      >
        <div className="border-b border-gray-100 px-8 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3665f3]">
            Step 8 · Payout information
          </p>
          <h2
            id="payout-information-guide-title"
            className="mt-3 text-2xl font-bold tracking-tight text-[#191919]"
          >
            Link your bank account
          </h2>
        </div>

        <div className="space-y-4 px-8 py-6 text-left">
          <p className="text-sm leading-relaxed text-[#555]">
            Enter the <strong className="text-[#191919]">business bank account</strong> where you want
            to receive your payouts. The name on the account must match your registered business name.
          </p>

          <div className="rounded-xl border border-gray-100 bg-[#f7f7f7] p-4">
            <p className="text-sm font-semibold text-[#191919]">UK bank details</p>
            <p className="mt-1 text-sm leading-relaxed text-[#555]">
              You will need your sort code and account number. Use a current or business account — not
              a savings account.
            </p>
          </div>

          <div className="rounded-xl border border-[#3665f3]/20 bg-[#f0f6ff] p-4">
            <p className="text-sm font-semibold text-[#191919]">Name on account</p>
            <p className="mt-1 text-sm leading-relaxed text-[#555]">
              Enter the account holder name exactly as it appears on your bank account and business
              records.
            </p>
          </div>
        </div>

        <div className="border-t border-gray-100 px-8 py-6">
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem(PAYOUT_INFORMATION_GUIDE_KEY, "true");
              onDismiss();
            }}
            className="w-full rounded-full bg-[#3665f3] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2f56cc]"
          >
            Got it, continue
          </button>
        </div>
      </div>
    </div>
  );
}
