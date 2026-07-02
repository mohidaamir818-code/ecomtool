 "use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { DashboardIcon } from "./DashboardIcon";

export function SettingsShell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState("");
  const [dailyUsed, setDailyUsed] = useState(0);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [emailMode, setEmailMode] = useState<"idle" | "otp" | "edit">("idle");
  const [emailOtp, setEmailOtp] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  const [passwordMode, setPasswordMode] = useState<"idle" | "otp" | "edit">("idle");
  const [passwordOtp, setPasswordOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => {
    const id = sessionStorage.getItem("ecomtools_user_id");
    if (!id) {
      setLoading(false);
      setError("User session not found.");
      return;
    }
    setUserId(id);
  }, []);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError("");
    void fetch(`/api/dashboard/settings?userId=${encodeURIComponent(userId)}`)
      .then(async (response) => {
        const data = (await response.json()) as {
          error?: string;
          email?: string;
          dailyUsed?: number;
          dailyLimit?: number | null;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load settings.");
        }
        setCurrentEmail(data.email ?? "");
        setDailyUsed(data.dailyUsed ?? 0);
        setDailyLimit(typeof data.dailyLimit === "number" ? data.dailyLimit : null);
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load settings.");
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const usagePercent = useMemo(() => {
    if (!dailyLimit || dailyLimit <= 0) return 0;
    return Math.min(100, Math.round((dailyUsed / dailyLimit) * 100));
  }, [dailyLimit, dailyUsed]);

  async function postSettings(body: Record<string, unknown>) {
    if (!userId) throw new Error("User session missing.");
    const response = await fetch("/api/dashboard/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...body }),
    });
    const data = (await response.json()) as { success?: boolean; message?: string; error?: string; email?: string };
    if (!response.ok || !data.success) {
      throw new Error(data.error ?? "Request failed.");
    }
    return data;
  }

  async function handleStartEmailChange() {
    setEmailBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await postSettings({ action: "send_otp" });
      setEmailMode("otp");
      setNotice(data.message ?? "Verification code sent.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to send code.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleVerifyEmailOtp() {
    setEmailBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await postSettings({ action: "verify_otp", otp: emailOtp });
      setEmailMode("edit");
      setNotice(data.message ?? "Code verified.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to verify code.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleSaveEmail() {
    setEmailBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await postSettings({ action: "change_email", otp: emailOtp, newEmail });
      const updatedEmail = data.email ?? newEmail.trim().toLowerCase();
      setCurrentEmail(updatedEmail);
      sessionStorage.setItem("ecomtools_user_email", updatedEmail);
      setEmailMode("idle");
      setEmailOtp("");
      setNewEmail("");
      setNotice(data.message ?? "Email updated.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update email.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleStartPasswordChange() {
    setPasswordBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await postSettings({ action: "send_otp" });
      setPasswordMode("otp");
      setNotice(data.message ?? "Verification code sent.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to send code.");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleVerifyPasswordOtp() {
    setPasswordBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await postSettings({ action: "verify_otp", otp: passwordOtp });
      setPasswordMode("edit");
      setNotice(data.message ?? "Code verified.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to verify code.");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleSavePassword() {
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await postSettings({
        action: "change_password",
        otp: passwordOtp,
        newPassword,
      });
      setPasswordMode("idle");
      setPasswordOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice(data.message ?? "Password updated.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1100px] space-y-6 p-6 lg:p-8">
        <header className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#111827]">Settings</h1>
              <p className="mt-1 text-sm text-[#6B7280]">
                Manage your account, security, and daily request limits.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Account Settings
            </span>
          </div>
        </header>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <DashboardIcon name="settings" className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-semibold text-[#111827]">Profile & Security</h2>
          </div>

          {error ? (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {notice}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Current Email
              </span>
              <input
                type="email"
                value={currentEmail}
                readOnly
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111827] outline-none"
              />
              {emailMode === "idle" ? (
                <button
                  type="button"
                  onClick={() => void handleStartEmailChange()}
                  disabled={loading || emailBusy}
                  className="mt-3 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-gray-100 disabled:opacity-60"
                >
                  {emailBusy ? "Sending..." : "Change email"}
                </button>
              ) : null}
              {emailMode === "otp" || emailMode === "edit" ? (
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={emailOtp}
                    onChange={(event) => setEmailOtp(event.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 6-digit code"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-brand"
                  />
                  {emailMode === "otp" ? (
                    <button
                      type="button"
                      onClick={() => void handleVerifyEmailOtp()}
                      disabled={emailBusy || emailOtp.length !== 6}
                      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
                    >
                      {emailBusy ? "Verifying..." : "Verify code"}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {emailMode === "edit" ? (
                <div className="mt-3 space-y-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    placeholder="Enter new email"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveEmail()}
                    disabled={emailBusy || !newEmail.trim()}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
                  >
                    {emailBusy ? "Saving..." : "Save new email"}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Password
              </span>
              <input
                type="password"
                value="********"
                readOnly
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-brand"
              />
              {passwordMode === "idle" ? (
                <button
                  type="button"
                  onClick={() => void handleStartPasswordChange()}
                  disabled={loading || passwordBusy}
                  className="mt-3 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-gray-100 disabled:opacity-60"
                >
                  {passwordBusy ? "Sending..." : "Change password"}
                </button>
              ) : null}
              {passwordMode === "otp" || passwordMode === "edit" ? (
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={passwordOtp}
                    onChange={(event) => setPasswordOtp(event.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 6-digit code"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-brand"
                  />
                  {passwordMode === "otp" ? (
                    <button
                      type="button"
                      onClick={() => void handleVerifyPasswordOtp()}
                      disabled={passwordBusy || passwordOtp.length !== 6}
                      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
                    >
                      {passwordBusy ? "Verifying..." : "Verify code"}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {passwordMode === "edit" ? (
                <div className="mt-3 space-y-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Enter new password"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-brand"
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Confirm new password"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSavePassword()}
                    disabled={passwordBusy || !newPassword || !confirmPassword}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
                  >
                    {passwordBusy ? "Saving..." : "Save new password"}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Daily Requests
              </span>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
                <div className="h-full rounded-full bg-brand" style={{ width: `${usagePercent}%` }} />
              </div>
              <p className="mt-2 text-sm font-medium text-[#111827]">
                {dailyUsed.toLocaleString()} /{" "}
                {dailyLimit === null ? "Unlimited" : dailyLimit.toLocaleString()} used today
              </p>
              <p className="mt-1 text-xs text-[#6B7280]">
                Daily request usage resets automatically every 24 hours.
              </p>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
