"use client";

export const CONTACT_STAKEHOLDERS_GUIDE_KEY = "learn_marketplace_contact_stakeholders_guide_ack";
export const CONTACT_STAKEHOLDERS_CURSOR_KEY_PREFIX =
  "learn_marketplace_contact_stakeholders_cursor_";
export const PRACTICE_BUSINESS_DETAILS_DONE_KEY =
  "learn_marketplace_practice_business_details_done";

export function LearnMarketplaceContactStakeholdersGuide({
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
        aria-labelledby="contact-stakeholders-guide-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl"
      >
        <div className="border-b border-gray-100 px-8 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3665f3]">
            Step 7 · Contact and stakeholders
          </p>
          <h2
            id="contact-stakeholders-guide-title"
            className="mt-3 text-2xl font-bold tracking-tight text-[#191919]"
          >
            Primary contact details
          </h2>
        </div>

        <div className="space-y-4 px-8 py-6 text-left">
          <p className="rounded-xl border border-[#3665f3]/30 bg-[#f0f6ff] p-4 text-sm leading-relaxed text-[#191919]">
            <strong className="font-bold">Always give your own country details.</strong>
          </p>

          <p className="text-sm leading-relaxed text-[#555]">
            Select your <strong className="text-[#191919]">nationality country</strong> and enter
            details exactly as they appear on your passport or government-issued ID — for example
            your full legal name, date of birth, and home address.
          </p>

          <div className="rounded-xl border border-gray-100 bg-[#f7f7f7] p-4">
            <p className="text-sm font-semibold text-[#191919]">Legal name</p>
            <p className="mt-1 text-sm leading-relaxed text-[#555]">
              First name, middle name (if on ID), and surname must match your passport or ID exactly.
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-[#f7f7f7] p-4">
            <p className="text-sm font-semibold text-[#191919]">Date of birth</p>
            <p className="mt-1 text-sm leading-relaxed text-[#555]">
              <strong className="text-[#191919]">Give the date exactly as on your ID</strong> — same day,
              month and year as printed on your passport or government-issued ID.
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-[#f7f7f7] p-4">
            <p className="text-sm font-semibold text-[#191919]">Legal residence</p>
            <p className="mt-1 text-sm leading-relaxed text-[#555]">
              <strong className="text-[#191919]">Write only the address of the company</strong> — use your
              company&apos;s registered business address, not a personal home address.
            </p>
          </div>
        </div>

        <div className="border-t border-gray-100 px-8 py-6">
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem(CONTACT_STAKEHOLDERS_GUIDE_KEY, "true");
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
