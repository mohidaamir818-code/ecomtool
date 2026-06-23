"use client";

import { useState } from "react";

interface AmazefConnectModalProps {
  userId: string;
  defaultEmail?: string | null;
  onConnected: (email: string | null) => void;
  onClose: () => void;
}

export function AmazefConnectModal({
  userId,
  defaultEmail = "",
  onConnected,
  onClose,
}: AmazefConnectModalProps) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    if (!email.trim() || !password) {
      setError("Enter your Amazef email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/amazef/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email: email.trim(), password }),
      });

      const data = (await response.json().catch(() => null)) as
        | { success?: boolean; connected?: boolean; amazefEmail?: string | null; error?: string }
        | null;

      if (!response.ok || !data?.success) {
        setError(data?.error ?? "Invalid Amazef email or password.");
        return;
      }

      onConnected(data.amazefEmail ?? email.trim());
    } catch {
      setError("Network error while connecting to Amazef.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#111827]">Connect your Amazef account</h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              Sign in with your Amazef email and password so we can list products to your store.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151]">Amazef email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-[#111827] focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151]">Amazef password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleConnect();
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-[#111827] focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="••••••••"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <p className="text-xs text-[#9CA3AF]">
            Your password is used once to verify your Amazef account and is never stored.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void handleConnect()}
            disabled={loading}
            className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Connecting..." : "Connect Amazef"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
