"use client";

export const BUSINESS_TYPE_GUIDE_KEY = "learn_marketplace_business_type_guide_ack";
export const BUSINESS_TYPE_CURSOR_KEY_PREFIX = "learn_marketplace_business_type_cursor_";
export const PRACTICE_BUSINESS_TYPE_KEY = "learn_marketplace_practice_business_type";

export type PracticeBusinessType = "sole" | "registered" | "charity";

export function LearnMarketplaceBusinessTypeGuide({
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
        aria-labelledby="business-type-guide-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl"
      >
        <div className="border-b border-gray-100 px-8 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3665f3]">
            Step 5 · Business type
          </p>
          <h2 id="business-type-guide-title" className="mt-3 text-2xl font-bold tracking-tight text-[#191919]">
            What type of business is this?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#555]">
            Select the option that best matches how your business is set up. This helps customise your
            seller sign-up experience.
          </p>
        </div>

        <div className="space-y-3 px-8 py-6 text-left">
          {[
            {
              title: "Sole tradership",
              text: "Choose this if you sell under your own name or a non-registered business.",
            },
            {
              title: "Registered business",
              text: "Choose this if your business is an Ltd, LLC, LLP, partnership, or other legal entity.",
            },
            {
              title: "Charity",
              text: "Choose this if your organisation is a registered charity.",
            },
          ].map((item, index) => (
            <div
              key={item.title}
              className="flex gap-3 rounded-xl border border-gray-100 bg-[#f7f7f7] p-4"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3665f3] text-xs font-bold text-white">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-[#191919]">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[#555]">{item.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 px-8 py-6">
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem(BUSINESS_TYPE_GUIDE_KEY, "true");
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
