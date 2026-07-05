"use client";

export const PHONE_VERIFY_GUIDE_KEY = "learn_marketplace_phone_verify_guide_ack";
export const PHONE_VERIFY_CURSOR_KEY_PREFIX = "learn_marketplace_phone_verify_cursor_";
export const PRACTICE_PHONE_OTP_KEY = "learn_marketplace_practice_phone_otp";

export function generatePracticePhoneOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function LearnMarketplacePhoneVerifyGuide({
  visible,
  phone,
  otp,
  onDismiss,
}: {
  visible: boolean;
  phone: string;
  otp: string;
  onDismiss: () => void;
}) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="verify-phone-guide-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl"
      >
        <div className="border-b border-gray-100 px-8 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3665f3]">
            Step 3 · Phone verification
          </p>
          <h2 id="verify-phone-guide-title" className="mt-3 text-2xl font-bold tracking-tight text-[#191919]">
            Verify your phone number
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#555]">
            In a real marketplace, an OTP would be sent by text to{" "}
            <span className="font-semibold text-[#191919]">{phone}</span>. For this practice session,
            enter the OTP shown below on the next screen.
          </p>
        </div>

        <div className="px-8 py-6">
          <div className="rounded-xl border border-[#3665f3]/20 bg-[#f0f6ff] p-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3665f3]">
              Your practice OTP
            </p>
            <p className="mt-3 text-4xl font-bold tracking-[0.35em] text-[#191919]">{otp}</p>
            <p className="mt-3 text-sm leading-relaxed text-[#555]">
              Type this 6-digit code into the boxes on the page, then click Verify.
            </p>
          </div>

          <ol className="mt-5 space-y-3 text-left">
            {[
              "The marketplace would normally send this code to your mobile number by SMS.",
              "On this practice page, use the OTP above instead of waiting for a real text.",
              "Enter all 6 digits, then click Verify to continue.",
            ].map((text, index) => (
              <li
                key={text}
                className="flex gap-3 rounded-xl border border-gray-100 bg-[#f7f7f7] p-4"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3665f3] text-xs font-bold text-white">
                  {index + 1}
                </span>
                <p className="text-sm leading-relaxed text-[#555]">{text}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="border-t border-gray-100 px-8 py-6">
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem(PHONE_VERIFY_GUIDE_KEY, "true");
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
