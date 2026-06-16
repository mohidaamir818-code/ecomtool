"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { FormField } from "./FormField";

type FormErrors = Partial<
  Record<"fullName" | "email" | "password" | "phone" | "form", string>
>;

export function SignUpForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateClient(): FormErrors {
    const next: FormErrors = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      next.fullName = "Enter your full name (at least 2 characters).";
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Enter a valid email address.";
    }

    if (!password || password.length < 8) {
      next.password = "Password must be at least 8 characters.";
    }

    if (!phone.trim() || phone.trim().length < 7) {
      next.phone = "Enter a valid phone number.";
    }

    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const clientErrors = validateClient();
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({ form: data.error ?? "Something went wrong. Please try again." });
        return;
      }

      sessionStorage.setItem("ecomtools_user_id", data.userId);
      sessionStorage.setItem("ecomtools_user_email", email.trim().toLowerCase());
      sessionStorage.setItem("ecomtools_user_name", fullName.trim());
      sessionStorage.removeItem("ecomtools_email_verified");
      sessionStorage.removeItem("ecomtools_onboarding_complete");

      const otpResponse = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: data.userId,
          email: email.trim().toLowerCase(),
        }),
      });

      const otpData = await otpResponse.json();

      if (!otpResponse.ok) {
        setErrors({
          form: otpData.error ?? "Account created but failed to send verification email.",
        });
        return;
      }

      router.push("/verify-email");
    } catch {
      setErrors({ form: "Network error. Please check your connection and try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <span className="inline-flex rounded-full border border-[#DDD6FE] bg-brand-light px-3 py-1 text-xs font-semibold text-brand">
          Step 1 of 3
        </span>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">
          Create your account
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
          Start your free trial today. No credit card required.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormField
          label="Full Name"
          name="fullName"
          type="text"
          placeholder="John Smith"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
        />

        <FormField
          label="Email Address"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />

        <FormField
          label="Password"
          name="password"
          type="password"
          placeholder="Minimum 8 characters"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint="Use at least 8 characters with letters and numbers."
        />

        <FormField
          label="Phone Number"
          name="phone"
          type="tel"
          placeholder="+1 (555) 000-0000"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
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
              Creating account...
            </>
          ) : (
            <>
              Start your free trial
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

      <p className="mt-6 text-center text-sm text-[#6B7280]">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-brand hover:text-brand-dark">
          Sign in
        </Link>
      </p>

      <p className="mt-8 text-center text-xs leading-relaxed text-[#9CA3AF]">
        By creating an account, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}
