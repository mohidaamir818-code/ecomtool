"use client";

import { useState } from "react";

export const LEARN_MARKETPLACE_EXPERIENCE_KEY = "learn_marketplace_experience";

export type MarketplaceExperience = "new" | "experienced";

const experienceOptions: Array<{
  value: MarketplaceExperience;
  title: string;
  description: string;
}> = [
  {
    value: "new",
    title: "New to marketplace selling",
    description: "I am just getting started and want to learn how buying and selling works.",
  },
  {
    value: "experienced",
    title: "Already working as a seller",
    description: "I already sell online and want to practise the marketplace workflow.",
  },
];

interface LearnMarketplaceExperiencePageProps {
  onContinue: (experience: MarketplaceExperience) => void;
}

export function LearnMarketplaceExperiencePage({ onContinue }: LearnMarketplaceExperiencePageProps) {
  const [selected, setSelected] = useState<MarketplaceExperience | null>(null);

  return (
    <div className="flex min-h-[calc(100vh-52px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-[720px] rounded-2xl border border-gray-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3665f3]">
            Marketplace practice
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#191919]">
            Before we begin
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[#555]">
            Help us tailor your practice session. This takes a few seconds and helps you follow the
            right learning path.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-[#191919]">
            What best describes your experience?
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {experienceOptions.map((option) => {
              const isSelected = selected === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelected(option.value)}
                  className={`rounded-xl border p-5 text-left transition ${
                    isSelected
                      ? "border-[#3665f3] bg-[#f0f6ff] ring-2 ring-[#3665f3]/20"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        isSelected ? "border-[#3665f3] bg-[#3665f3]" : "border-gray-300 bg-white"
                      }`}
                      aria-hidden
                    >
                      {isSelected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-[#191919]">{option.title}</span>
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
            disabled={!selected}
            onClick={() => {
              if (selected) onContinue(selected);
            }}
            className={`rounded-full px-8 py-3 text-sm font-semibold text-white transition ${
              selected
                ? "bg-[#3665f3] hover:bg-[#2f56cc]"
                : "cursor-not-allowed bg-[#9db3f3]"
            }`}
          >
            Continue to practice
          </button>
        </div>
      </div>
    </div>
  );
}
