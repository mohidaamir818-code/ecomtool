"use client";

export const BUSINESS_DETAILS_NEXT_STEP_GUIDE_KEY =
  "learn_marketplace_business_details_next_step_guide_ack";

export function LearnMarketplaceBusinessDetailsNextStepGuide({
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
        aria-labelledby="business-details-next-step-title"
        className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-xl"
      >
        <div className="border-b border-gray-100 px-8 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3665f3]">
            Important — read carefully
          </p>
          <h2
            id="business-details-next-step-title"
            className="mt-3 text-2xl font-bold tracking-tight text-[#191919]"
          >
            What happens next
          </h2>
        </div>

        <div className="space-y-4 px-8 py-6 text-left">
          <p className="text-sm leading-relaxed text-[#555]">
            After you continue, the marketplace may do <strong>one of two things</strong>:
          </p>

          <div className="rounded-xl border border-gray-100 bg-[#f7f7f7] p-4">
            <p className="text-sm font-semibold text-[#191919]">1. Phone verification code</p>
            <p className="mt-1 text-sm leading-relaxed text-[#555]">
              You may receive a code by text or call on the phone number you entered. Enter that code
              when asked.
            </p>
          </div>

          <div className="rounded-xl border border-[#3665f3]/20 bg-[#f0f6ff] p-4">
            <p className="text-sm font-semibold text-[#191919]">2. Address selection popup</p>
            <p className="mt-1 text-sm leading-relaxed text-[#555]">
              You may see a popup asking you to choose between a <strong>Recommended</strong> address
              and <strong>Your address</strong>.
            </p>
            <p className="mt-3 text-sm font-semibold text-[#191919]">
              Always select <span className="text-[#3665f3]">Your address</span> — not the
              recommended option.
            </p>
          </div>

          <p className="text-sm leading-relaxed text-[#555]">
            Use the address details you just entered on the business details form. Do not accept a
            suggested address unless it exactly matches your registered business address.
          </p>
        </div>

        <div className="border-t border-gray-100 px-8 py-6">
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem(BUSINESS_DETAILS_NEXT_STEP_GUIDE_KEY, "true");
              onDismiss();
            }}
            className="w-full rounded-full bg-[#3665f3] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2f56cc]"
          >
            I understand, continue
          </button>
        </div>
      </div>
    </div>
  );
}
