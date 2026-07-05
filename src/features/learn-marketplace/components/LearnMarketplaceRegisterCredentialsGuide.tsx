"use client";

import { useEffect, useState } from "react";

const REGISTER_CREDENTIALS_GUIDE_KEY = "learn_marketplace_register_credentials_ack";

const credentialSteps = [
  {
    title: "Your business name",
    description: "Enter your company name as registered, for example Ltd, LLC, or GmbH.",
  },
  {
    title: "Email",
    description:
      "Use the email you registered with ecomtool. Do not use an email already linked to other marketplaces.",
  },
  {
    title: "Password",
    description: "Set a strong password with more than 8 characters, including letters and numbers.",
  },
  {
    title: "Business country",
    description: "Select the country where your business is officially registered.",
  },
];

export function LearnMarketplaceRegisterCredentialsGuide() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const acknowledged = sessionStorage.getItem(REGISTER_CREDENTIALS_GUIDE_KEY) === "true";
    if (!acknowledged) {
      setVisible(true);
    }
  }, []);

  function handleContinue() {
    sessionStorage.setItem(REGISTER_CREDENTIALS_GUIDE_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-credentials-guide-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl"
      >
        <div className="border-b border-gray-100 px-8 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3665f3]">
            Step 1 · Account setup
          </p>
          <h2
            id="register-credentials-guide-title"
            className="mt-3 text-2xl font-bold tracking-tight text-[#191919]"
          >
            Now give your account credentials
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#555]">
            Complete the form below with accurate business details. Follow each point carefully before
            you continue.
          </p>
        </div>

        <ol className="space-y-4 px-8 py-6">
          {credentialSteps.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-xl border border-gray-100 bg-[#f7f7f7] p-4"
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
