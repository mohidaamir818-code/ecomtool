"use client";

import { useState } from "react";

type Step = "credentials" | "otp";

export function AdminAuthForm({ adminPath }: { adminPath: string }) {
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingToken, setPendingToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCredentialsSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setError("Invalid credentials or access denied.");
        return;
      }

      const data = (await response.json()) as { pendingToken?: string };
      if (!data.pendingToken) {
        setError("Login failed. Try again.");
        return;
      }

      setPendingToken(data.pendingToken);
      setStep("otp");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken, otp }),
      });

      if (!response.ok) {
        setError("Invalid or expired code.");
        return;
      }

      window.location.href = adminPath;
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "otp") {
    return (
      <form onSubmit={handleOtpSubmit} className="w-full max-w-md space-y-4">
        <div>
          <h1 className="text-xl font-bold text-white">Enter verification code</h1>
          <p className="mt-1 text-sm text-white/60">
            Check your admin email for the 6-digit code.
          </p>
        </div>

        <input
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-center text-lg tracking-[0.4em] text-white outline-none focus:border-white/40"
        />

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || otp.length !== 6}
          className="w-full rounded-xl bg-[#5842f4] px-4 py-3 text-sm font-semibold text-white hover:bg-[#4935d9] disabled:opacity-60"
        >
          {loading ? "Verifying..." : "Verify and continue"}
        </button>

        <button
          type="button"
          onClick={() => {
            setStep("credentials");
            setOtp("");
            setPendingToken("");
            setError("");
          }}
          className="w-full text-sm text-white/60 hover:text-white"
        >
          Back to login
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleCredentialsSubmit} className="w-full max-w-md space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Admin sign in</h1>
        <p className="mt-1 text-sm text-white/60">Credentials are checked before OTP is sent.</p>
      </div>

      <input
        type="email"
        required
        autoComplete="username"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Admin email"
        className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/40"
      />

      <input
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/40"
      />

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-[#5842f4] px-4 py-3 text-sm font-semibold text-white hover:bg-[#4935d9] disabled:opacity-60"
      >
        {loading ? "Sending code..." : "Continue"}
      </button>
    </form>
  );
}
