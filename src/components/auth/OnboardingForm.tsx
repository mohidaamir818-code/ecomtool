"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { FormField } from "./FormField";
import { ReadOnlyField, SelectField } from "./SelectField";
import type { SellingPlatform } from "@/types/auth";

const PLATFORM_OPTIONS: { value: SellingPlatform; label: string }[] = [
  { value: "Amazef", label: "Amazef" },
  { value: "eBay", label: "eBay" },
];

type FormErrors = Partial<
  Record<"heardAboutUs" | "platform" | "form", string>
>;

export function OnboardingForm() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [heardAboutUs, setHeardAboutUs] = useState("");
  const [platform, setPlatform] = useState<SellingPlatform | "">("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const storedUserId = sessionStorage.getItem("ecomtools_user_id");
    const emailVerified =
      sessionStorage.getItem("ecomtools_email_verified") === "true";

    if (!storedUserId) {
      router.replace("/sign-up");
      return;
    }

    if (!emailVerified) {
      router.replace("/verify-email");
      return;
    }
    setUserId(storedUserId);
  }, [router]);

  function validateClient(): FormErrors {
    const next: FormErrors = {};

    if (!heardAboutUs.trim() || heardAboutUs.trim().length < 2) {
      next.heardAboutUs = "Please tell us where you heard about us.";
    }

    if (!platform) {
      next.platform = "Please select a platform.";
    }

    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    if (!userId) return;

    const clientErrors = validateClient();
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          heardAboutUs,
          platform,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({ form: data.error ?? "Something went wrong. Please try again." });
        return;
      }

      sessionStorage.setItem("ecomtools_onboarding_complete", "true");
      router.push("/dashboard");
    } catch {
      setErrors({ form: "Network error. Please check your connection and try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!userId) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg
          className="h-8 w-8 animate-spin text-brand"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <span className="inline-flex rounded-full border border-[#DDD6FE] bg-brand-light px-3 py-1 text-xs font-semibold text-brand">
          Step 3 of 3
        </span>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">
          Tell us about your business
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
          Help us personalize your experience with a few quick questions.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormField
          label="Where did you hear about us?"
          name="heardAboutUs"
          type="text"
          placeholder="e.g. Google, YouTube, friend referral..."
          value={heardAboutUs}
          onChange={(e) => setHeardAboutUs(e.target.value)}
          error={errors.heardAboutUs}
        />

        <SelectField
          label="On which platform do you work?"
          name="platform"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as SellingPlatform)}
          options={PLATFORM_OPTIONS}
          placeholder="Select your platform"
          error={errors.platform}
          hint="Choose the marketplace you sell on."
        />

        <ReadOnlyField
          label="Supplier"
          value="AliExpress"
          hint="Your product supplier is automatically set to AliExpress."
        />

        {errors.form && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {errors.form}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(88,66,244,0.35)] transition-all hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <svg
                className="h-5 w-5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Saving...
            </>
          ) : (
            <>
              Complete setup
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path
                  d="M3.75 9h10.5M9.75 4.5L14.25 9l-4.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
