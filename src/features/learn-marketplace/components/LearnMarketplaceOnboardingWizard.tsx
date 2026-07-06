"use client";

import { useState } from "react";
import { MARKETPLACE_PHONE_COUNTRIES } from "@/features/learn-marketplace/data/marketplace-phone-countries";
import {
  LEARN_MARKETPLACE_EXPERIENCE_KEY,
  type MarketplaceExperience,
} from "@/features/learn-marketplace/components/LearnMarketplaceExperiencePage";

export const LEARN_MARKETPLACE_SELLER_COUNTRY_KEY = "learn_marketplace_seller_country";
export const LEARN_MARKETPLACE_REGISTERED_COMPANY_KEY = "learn_marketplace_registered_company";
export const LEARN_MARKETPLACE_ONBOARDING_COMPLETE_KEY = "learn_marketplace_onboarding_complete";

const experienceOptions: Array<{
  value: MarketplaceExperience;
  title: string;
  description: string;
}> = [
  {
    value: "new",
    title: "New to marketplace selling",
    description:
      "I am building my selling knowledge and want a guided introduction to the full workflow.",
  },
  {
    value: "experienced",
    title: "Experienced online seller",
    description:
      "I already sell on marketplaces and want to practise this platform's process step by step.",
  },
];

const learningPathSteps = [
  {
    number: 1,
    title: "IP setup",
    description:
      "Configure your business identity, policies, and compliance settings before you start selling.",
  },
  {
    number: 2,
    title: "Account creation",
    description:
      "Register your seller account, verify your details, and link payout information.",
  },
  {
    number: 3,
    title: "Hunting",
    description:
      "Research products and suppliers to find profitable opportunities for your store.",
  },
  {
    number: 4,
    title: "First listing",
    description:
      "Create and publish your first product listing with titles, photos, and pricing.",
  },
  {
    number: 5,
    title: "Listing",
    description:
      "Manage and optimise your catalogue — update stock, pricing, and listing quality over time.",
  },
  {
    number: 6,
    title: "Order management",
    description:
      "Process orders, handle fulfilment, and maintain buyer communication after you start selling.",
  },
] as const;

const companyOptions = [
  {
    value: "yes" as const,
    title: "Yes — registered company",
    description:
      "I sell through a legally registered business entity (e.g. Ltd, LLC, or equivalent).",
  },
  {
    value: "no" as const,
    title: "No — individual seller",
    description:
      "I sell as an individual or sole trader and do not operate through a registered company.",
  },
];

type WizardStep = "experience" | "country" | "roadmap" | "company";

interface LearnMarketplaceOnboardingWizardProps {
  onComplete: () => void;
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3665f3]">
      Step {current} of {total}
    </p>
  );
}

export function LearnMarketplaceOnboardingWizard({ onComplete }: LearnMarketplaceOnboardingWizardProps) {
  const [step, setStep] = useState<WizardStep>("experience");
  const [experience, setExperience] = useState<MarketplaceExperience | null>(null);
  const [country, setCountry] = useState("");
  const [registeredCompany, setRegisteredCompany] = useState<"yes" | "no" | null>(null);

  const stepNumber =
    step === "experience" ? 1 : step === "country" ? 2 : step === "roadmap" ? 3 : 4;

  function finishOnboarding() {
    if (!experience || !country || !registeredCompany) return;

    sessionStorage.setItem(LEARN_MARKETPLACE_EXPERIENCE_KEY, experience);
    sessionStorage.setItem(LEARN_MARKETPLACE_SELLER_COUNTRY_KEY, country);
    sessionStorage.setItem(LEARN_MARKETPLACE_REGISTERED_COMPANY_KEY, registeredCompany);
    sessionStorage.setItem(LEARN_MARKETPLACE_ONBOARDING_COMPLETE_KEY, "true");
    onComplete();
  }

  return (
    <div className="flex min-h-[calc(100vh-52px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-[760px] rounded-2xl border border-gray-200 bg-white p-8 shadow-sm sm:p-10">
        {step === "experience" ? (
          <>
            <div className="mb-8 text-center">
              <StepIndicator current={1} total={4} />
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#191919]">
                Seller onboarding assessment
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#555]">
                Before we begin your marketplace practice, please tell us about your selling
                background so we can personalise your learning path.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-[#191919]">
                What best describes your current selling experience?
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {experienceOptions.map((option) => {
                  const isSelected = experience === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setExperience(option.value)}
                      className={`rounded-xl border p-5 text-left transition ${
                        isSelected
                          ? "border-[#3665f3] bg-[#f0f6ff] ring-2 ring-[#3665f3]/20"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            isSelected
                              ? "border-[#3665f3] bg-[#3665f3]"
                              : "border-gray-300 bg-white"
                          }`}
                          aria-hidden
                        >
                          {isSelected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-[#191919]">
                            {option.title}
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-[#555]">
                            {option.description}
                          </span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 flex justify-end border-t border-gray-100 pt-6">
              <button
                type="button"
                disabled={!experience}
                onClick={() => setStep("country")}
                className={`rounded-full px-8 py-3 text-sm font-semibold text-white transition ${
                  experience
                    ? "bg-[#3665f3] hover:bg-[#2f56cc]"
                    : "cursor-not-allowed bg-[#9db3f3]"
                }`}
              >
                Continue
              </button>
            </div>
          </>
        ) : null}

        {step === "country" ? (
          <>
            <div className="mb-8 text-center">
              <StepIndicator current={2} total={4} />
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#191919]">
                Your primary operating country
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#555]">
                Select the country where your business is registered or where you will primarily
                operate your marketplace selling activity. This helps us align compliance and
                account setup guidance with your region.
              </p>
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-[#191919]">
                Which country will you operate from?
              </span>
              <select
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#3665f3] focus:ring-2 focus:ring-[#3665f3]/20"
              >
                <option value="" disabled>
                  Select your country
                </option>
                {MARKETPLACE_PHONE_COUNTRIES.map((item) => (
                  <option key={item.iso} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-8 flex justify-between border-t border-gray-100 pt-6">
              <button
                type="button"
                onClick={() => setStep("experience")}
                className="rounded-full border border-gray-300 px-6 py-3 text-sm font-semibold text-[#555] transition hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!country}
                onClick={() => setStep("roadmap")}
                className={`rounded-full px-8 py-3 text-sm font-semibold text-white transition ${
                  country
                    ? "bg-[#3665f3] hover:bg-[#2f56cc]"
                    : "cursor-not-allowed bg-[#9db3f3]"
                }`}
              >
                Continue
              </button>
            </div>
          </>
        ) : null}

        {step === "roadmap" ? (
          <>
            <div className="mb-8 text-center">
              <StepIndicator current={3} total={4} />
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#191919]">
                Your learning roadmap
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#555]">
                You will work through the following stages in order. Each step builds on the last,
                from initial setup through to managing live orders on the marketplace.
              </p>
            </div>

            <ol className="space-y-3">
              {learningPathSteps.map((item) => (
                <li
                  key={item.title}
                  className="flex gap-4 rounded-xl border border-gray-100 bg-[#f7f7f7] p-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3665f3] text-sm font-bold text-white">
                    {item.number}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#191919]">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[#555]">{item.description}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-8 flex justify-between border-t border-gray-100 pt-6">
              <button
                type="button"
                onClick={() => setStep("country")}
                className="rounded-full border border-gray-300 px-6 py-3 text-sm font-semibold text-[#555] transition hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep("company")}
                className="rounded-full bg-[#3665f3] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#2f56cc]"
              >
                Continue
              </button>
            </div>
          </>
        ) : null}

        {step === "company" ? (
          <>
            <div className="mb-8 text-center">
              <StepIndicator current={4} total={4} />
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#191919]">
                Business structure
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#555]">
                Marketplace account requirements differ depending on whether you sell as a registered
                company or as an individual. Please confirm which applies to your situation.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-[#191919]">
                Do you have a registered company through which you will sell?
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {companyOptions.map((option) => {
                  const isSelected = registeredCompany === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRegisteredCompany(option.value)}
                      className={`rounded-xl border p-5 text-left transition ${
                        isSelected
                          ? "border-[#3665f3] bg-[#f0f6ff] ring-2 ring-[#3665f3]/20"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            isSelected
                              ? "border-[#3665f3] bg-[#3665f3]"
                              : "border-gray-300 bg-white"
                          }`}
                          aria-hidden
                        >
                          {isSelected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-[#191919]">
                            {option.title}
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-[#555]">
                            {option.description}
                          </span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 flex justify-between border-t border-gray-100 pt-6">
              <button
                type="button"
                onClick={() => setStep("roadmap")}
                className="rounded-full border border-gray-300 px-6 py-3 text-sm font-semibold text-[#555] transition hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!registeredCompany}
                onClick={finishOnboarding}
                className={`rounded-full px-8 py-3 text-sm font-semibold text-white transition ${
                  registeredCompany
                    ? "bg-[#3665f3] hover:bg-[#2f56cc]"
                    : "cursor-not-allowed bg-[#9db3f3]"
                }`}
              >
                Start practice
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
