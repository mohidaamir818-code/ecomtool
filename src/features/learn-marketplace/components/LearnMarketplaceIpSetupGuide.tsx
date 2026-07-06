"use client";

import { useEffect, useState } from "react";
import { LEARN_MARKETPLACE_SELLER_COUNTRY_KEY } from "@/features/learn-marketplace/components/LearnMarketplaceOnboardingWizard";

export const LEARN_MARKETPLACE_IP_SETUP_GUIDE_ACK_KEY = "learn_marketplace_ip_setup_guide_ack";

const IPBURGER_CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/ipburger-proxy-vpn/kchocjcihdgkoplngjemhpplmmloanja";

const setupSteps = [
  {
    title: "Install the extension",
    text: "Open the Chrome Web Store and add the IPBurger Proxy & VPN extension to your browser.",
  },
  {
    title: "Select your operating country",
    text: "Connect to an IP address in the country where you will operate your marketplace selling activity.",
  },
  {
    title: "Verify your connection",
    text: "Confirm that your browser location, timezone, and language settings align with your chosen operating country before proceeding.",
  },
  {
    title: "Keep it active",
    text: "Leave IPBurger connected whenever you access your seller account to maintain consistent regional compliance.",
  },
] as const;

interface LearnMarketplaceIpSetupGuideProps {
  onComplete: () => void;
}

export function LearnMarketplaceIpSetupGuide({ onComplete }: LearnMarketplaceIpSetupGuideProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [operatingCountry, setOperatingCountry] = useState("your operating country");

  useEffect(() => {
    const country = sessionStorage.getItem(LEARN_MARKETPLACE_SELLER_COUNTRY_KEY);
    if (country) setOperatingCountry(country);
  }, []);

  function handleContinue() {
    sessionStorage.setItem(LEARN_MARKETPLACE_IP_SETUP_GUIDE_ACK_KEY, "true");
    onComplete();
  }

  return (
    <div className="flex min-h-[calc(100vh-52px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-[760px] rounded-2xl border border-gray-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3665f3]">
            Step 1 · IP setup
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#191919]">
            Configure your operating IP address
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#555]">
            Because your company is registered in a different country, you must align your browser IP
            with <span className="font-semibold text-[#191919]">{operatingCountry}</span> before
            creating your seller account. This helps ensure your account setup reflects your true
            operating region.
          </p>
        </div>

        <div className="rounded-xl border border-[#3665f3]/20 bg-[#f0f6ff] p-5">
          <p className="text-sm text-[#555]">
            For IP setup, install the IPBurger extension to match your operating country.
          </p>
          <a
            href={IPBURGER_CHROME_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center rounded-full bg-[#3665f3] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2f56cc]"
          >
            Add IPBurger
          </a>
          <p className="mt-4 text-sm font-semibold text-[#191919]">Why IPBurger?</p>
          <p className="mt-2 text-sm leading-relaxed text-[#555]">
            IPBurger is a premium proxy and VPN extension that lets you route your browser traffic
            through your operating country. It also helps protect your IP address, block WebRTC leaks,
            and match timezone and language settings automatically.
          </p>
        </div>

        <ol className="mt-6 space-y-3">
          {setupSteps.map((item, index) => (
            <li
              key={item.title}
              className="flex gap-4 rounded-xl border border-gray-100 bg-[#f7f7f7] p-4"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3665f3] text-sm font-bold text-white">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-[#191919]">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[#555]">{item.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4 transition hover:bg-gray-50">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#3665f3] focus:ring-[#3665f3]"
          />
          <span className="text-sm leading-relaxed text-[#555]">
            I understand that my browser IP must match my operating country, and I have installed
            IPBurger or an equivalent solution to proceed with account creation.
          </span>
        </label>

        <div className="mt-8 flex justify-end border-t border-gray-100 pt-6">
          <button
            type="button"
            disabled={!confirmed}
            onClick={handleContinue}
            className={`rounded-full px-8 py-3 text-sm font-semibold text-white transition ${
              confirmed
                ? "bg-[#3665f3] hover:bg-[#2f56cc]"
                : "cursor-not-allowed bg-[#9db3f3]"
            }`}
          >
            Continue to marketplace practice
          </button>
        </div>
      </div>
    </div>
  );
}
