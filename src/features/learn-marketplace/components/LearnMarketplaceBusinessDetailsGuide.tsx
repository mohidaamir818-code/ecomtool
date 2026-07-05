"use client";

export const BUSINESS_DETAILS_GUIDE_KEY = "learn_marketplace_business_details_guide_ack";
export const BUSINESS_DETAILS_CURSOR_KEY_PREFIX = "learn_marketplace_business_details_cursor_";

const guideSections = [
  {
    title: "Business profile",
    text: "Enter your legal business name and company registration number exactly as shown on your business licence.",
  },
  {
    title: "Business address",
    text: "Use the registered business address from your licence. Country should be United Kingdom unless your business is registered elsewhere.",
  },
  {
    title: "Contact information",
    text: "Add the phone number you want to use for verification. It should match the number you entered earlier in sign-up.",
  },
];

export function LearnMarketplaceBusinessDetailsGuide({
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
        aria-labelledby="business-details-guide-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl"
      >
        <div className="border-b border-gray-100 px-8 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3665f3]">
            Step 6 · Business details
          </p>
          <h2
            id="business-details-guide-title"
            className="mt-3 text-2xl font-bold tracking-tight text-[#191919]"
          >
            Enter your business details
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#555]">
            Fill in each section carefully. Your business name and address may appear on listings and
            be shared with buyers after purchase.
          </p>
        </div>

        <div className="space-y-3 px-8 py-6 text-left">
          {guideSections.map((section, index) => (
            <div
              key={section.title}
              className="flex gap-3 rounded-xl border border-gray-100 bg-[#f7f7f7] p-4"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3665f3] text-xs font-bold text-white">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-[#191919]">{section.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[#555]">{section.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 px-8 py-6">
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem(BUSINESS_DETAILS_GUIDE_KEY, "true");
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
