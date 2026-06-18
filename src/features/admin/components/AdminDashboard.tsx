"use client";

import { useState } from "react";

export function AdminDashboard({ email }: { email: string }) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      window.location.reload();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white/60">Signed in as</p>
          <p className="text-lg font-bold text-white">{email}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
        >
          {loggingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
        <h2 className="text-base font-bold text-white">EcomTools Admin</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          Secure admin access is active. This panel is hidden from the public site and protected
          by IP whitelist, email/password login, and OTP verification.
        </p>
      </div>
    </div>
  );
}
