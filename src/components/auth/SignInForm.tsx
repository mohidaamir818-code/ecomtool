"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { FormField } from "./FormField";
import { getRedirectPath, saveAuthSession } from "@/lib/auth/session";
import type { SignInResponse } from "@/types/auth";

type FormErrors = Partial<Record<"email" | "password" | "form", string>>;

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateClient(): FormErrors {
    const next: FormErrors = {};

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Enter a valid email address.";
    }

    if (!password) {
      next.password = "Enter your password.";
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
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as SignInResponse & { error?: string };

      if (!response.ok) {
        setErrors({ form: data.error ?? "Sign-in failed. Please try again." });
        return;
      }

      saveAuthSession(data);

      if (data.nextStep === "verify-email") {
        await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: data.userId, email: data.email }),
        });
      }

      router.push(getRedirectPath(data.nextStep!));
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
          Welcome back
        </span>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">
          Sign in to your account
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
          Enter your email and password to continue to your dashboard.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
          placeholder="Enter your password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
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
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#6B7280]">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="font-semibold text-brand hover:text-brand-dark">
          Start your free trial
        </Link>
      </p>
    </div>
  );
}
