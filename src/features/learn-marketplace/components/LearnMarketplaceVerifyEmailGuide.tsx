"use client";

import { useEffect, useState } from "react";

const VERIFY_EMAIL_GUIDE_KEY = "learn_marketplace_verify_email_guide_ack";

const verifySteps = [
  {
    title: "Check your inbox",
    description: "Open Gmail or your email app and look for the verification code sent by ecomtool.",
  },
  {
    title: "Check spam folder",
    description: "If you cannot find the email in your inbox, open the spam or junk folder and search again.",
  },
  {
    title: "Resend the code",
    description: 'Still no email? Click "Get another one" on this page to receive a new verification code.',
  },
  {
    title: "Enter the code",
    description: "Type the 6-digit code into the boxes below, then click Verify to continue.",
  },
];

export function LearnMarketplaceVerifyEmailGuide() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const acknowledged = sessionStorage.getItem(VERIFY_EMAIL_GUIDE_KEY) === "true";
    if (!acknowledged) {
      setVisible(true);
    }
  }, []);

  function handleContinue() {
    sessionStorage.setItem(VERIFY_EMAIL_GUIDE_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="verify-email-guide-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl"
      >
        <div className="border-b border-gray-100 px-8 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3665f3]">
            Step 2 · Email verification
          </p>
          <h2 id="verify-email-guide-title" className="mt-3 text-2xl font-bold tracking-tight text-[#191919]">
            Verify your email
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#555]">
            A security code has been sent to your email. Follow the steps below before you enter the code.
          </p>
        </div>

        <ol className="space-y-4 px-8 py-6">
          {verifySteps.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-xl border border-gray-100 bg-[#f7f7f7] p-4 text-left"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3665f3] text-sm font-bold text-white">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-[#191919]">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[#555]">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="border-t border-gray-100 px-8 py-6">
          <button
            type="button"
            onClick={handleContinue}
            className="w-full rounded-full bg-[#3665f3] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2f56cc]"
          >
            Got it, continue
          </button>
        </div>
      </div>
    </div>
  );
}
