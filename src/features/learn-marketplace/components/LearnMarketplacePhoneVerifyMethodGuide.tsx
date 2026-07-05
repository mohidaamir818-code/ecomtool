"use client";

export const PHONE_METHOD_GUIDE_KEY = "learn_marketplace_phone_method_guide_ack";
export const PHONE_METHOD_CURSOR_KEY_PREFIX = "learn_marketplace_phone_method_cursor_";

export function LearnMarketplacePhoneVerifyMethodGuide({
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
        aria-labelledby="phone-method-guide-title"
        className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-xl"
      >
        <div className="border-b border-gray-100 px-8 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3665f3]">
            Step 3 · Phone verification
          </p>
          <h2 id="phone-method-guide-title" className="mt-3 text-2xl font-bold tracking-tight text-[#191919]">
            Choose how to verify
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#555]">
            On the next screen, you must <strong>only choose Text message</strong> to receive your security
            code. Do not select the phone call option.
          </p>
        </div>

        <div className="space-y-3 px-8 py-6 text-left">
          <div className="rounded-xl border border-[#3665f3]/20 bg-[#f0f6ff] p-4">
            <p className="text-sm font-semibold text-[#191919]">Text message</p>
            <p className="mt-1 text-sm leading-relaxed text-[#555]">
              Select this option. A 6-digit code will be sent to your mobile number by SMS.
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-[#f7f7f7] p-4 opacity-80">
            <p className="text-sm font-semibold text-[#191919]">Call me with a code</p>
            <p className="mt-1 text-sm leading-relaxed text-[#555]">Do not use this option during practice.</p>
          </div>
        </div>

        <div className="border-t border-gray-100 px-8 py-6">
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem(PHONE_METHOD_GUIDE_KEY, "true");
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

