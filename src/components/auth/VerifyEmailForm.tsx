"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { FormField } from "./FormField";

type FormErrors = Partial<Record<"otp" | "form", string>>;

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 2))}@${domain}`;
}

export function VerifyEmailForm() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  useEffect(() => {
    const storedUserId = sessionStorage.getItem("ecomtools_user_id");
    const storedEmail = sessionStorage.getItem("ecomtools_user_email");

    if (!storedUserId || !storedEmail) {
      router.replace("/sign-up");
      return;
    }

    if (sessionStorage.getItem("ecomtools_email_verified") === "true") {
      router.replace("/onboarding");
      return;
    }

    setUserId(storedUserId);
    setEmail(storedEmail);
  }, [router]);

  async function handleResend() {
    if (!userId || !email) return;

    setIsResending(true);
    setResendMessage("");
    setErrors({});

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({ form: data.error ?? "Failed to resend code." });
        return;
      }

      setResendMessage("A new verification code has been sent to your email.");
    } catch {
      setErrors({ form: "Network error. Please try again." });
    } finally {
      setIsResending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setResendMessage("");

    if (!userId) return;

    if (!/^\d{6}$/.test(otp.trim())) {
      setErrors({ otp: "Enter the 6-digit code from your email." });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, otp: otp.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({ form: data.error ?? "Verification failed. Please try again." });
        return;
      }

      sessionStorage.setItem("ecomtools_email_verified", "true");
      router.push("/onboarding");
    } catch {
      setErrors({ form: "Network error. Please check your connection and try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!userId || !email) {
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
          Step 2 of 3
        </span>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">
          Verify your email
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
          We sent a 6-digit verification code to{" "}
          <span className="font-semibold text-[#374151]">{maskEmail(email)}</span>.
          Enter it below to continue.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormField
          label="Verification Code"
          name="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          error={errors.otp}
          hint="Check your inbox and spam folder. Code expires in 10 minutes."
        />

        {resendMessage && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {resendMessage}
          </div>
        )}

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
          {isSubmitting ? "Verifying..." : "Verify & continue"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#6B7280]">
        Didn&apos;t receive the code?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={isResending}
          className="font-semibold text-brand hover:text-brand-dark disabled:opacity-60"
        >
          {isResending ? "Sending..." : "Resend code"}
        </button>
      </p>
    </div>
  );
}
