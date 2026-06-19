"use client";

import { useCallback, useEffect, useState } from "react";
import { PLATFORM_LABELS } from "@/lib/quota/constants";
import type { PlatformQuota, QuotaPlatform } from "@/types/quota";

const PLATFORMS: QuotaPlatform[] = ["ebay", "aliexpress", "amazef"];

export function AdminQuotaEditor({
  userId,
  userEmail,
}: {
  userId: string;
  userEmail: string;
}) {
  const [quotas, setQuotas] = useState<PlatformQuota[]>([]);
  const [inputs, setInputs] = useState<Record<QuotaPlatform, string>>({
    ebay: "",
    aliexpress: "",
    amazef: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<QuotaPlatform | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/quota/${encodeURIComponent(userId)}`);
      if (!response.ok) return;
      const payload = (await response.json()) as { quotas: PlatformQuota[] };
      setQuotas(payload.quotas);
      const nextInputs = { ebay: "", aliexpress: "", amazef: "" };
      for (const quota of payload.quotas) {
        nextInputs[quota.platform] =
          quota.dailyLimit === null ? "" : String(quota.dailyLimit);
      }
      setInputs(nextInputs);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleIncrease(platform: QuotaPlatform) {
    setSaving(platform);
    setMessage("");

    const raw = inputs[platform].trim();
    const newLimit = raw === "" || raw.toLowerCase() === "unlimited" ? null : Number(raw);

    if (newLimit !== null && (!Number.isFinite(newLimit) || newLimit < 0)) {
      setMessage("Enter a valid limit or leave blank for unlimited.");
      setSaving(null);
      return;
    }

    try {
      const response = await fetch("/api/admin/quota/increase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, platform, newLimit, adminEmail: "admin" }),
      });

      if (!response.ok) {
        setMessage("Failed to update limit.");
        return;
      }

      setMessage(`Updated ${PLATFORM_LABELS[platform]} limit. Email sent to ${userEmail}.`);
      await load();
    } catch {
      setMessage("Network error while updating limit.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-white/5" />;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Platform request limits</h2>
        <p className="mt-1 text-sm text-white/60">
          Increase daily limits per platform. User receives an email notification.
        </p>
      </div>

      {PLATFORMS.map((platform) => {
        const current = quotas.find((q) => q.platform === platform);
        const currentLabel =
          current?.unlimited || current?.dailyLimit === null
            ? "Unlimited"
            : String(current?.dailyLimit ?? 500);

        return (
          <div
            key={platform}
            className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{PLATFORM_LABELS[platform]}</p>
              <p className="text-xs text-white/50">
                Current: {currentLabel} · Used today: {current?.usedToday ?? 0}
              </p>
              <input
                type="text"
                value={inputs[platform]}
                onChange={(event) =>
                  setInputs((prev) => ({ ...prev, [platform]: event.target.value }))
                }
                placeholder="New daily limit (blank = unlimited)"
                className="mt-2 w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              />
            </div>
            <button
              type="button"
              disabled={saving === platform}
              onClick={() => void handleIncrease(platform)}
              className="rounded-lg bg-[#5842f4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4935d9] disabled:opacity-60"
            >
              {saving === platform ? "Saving..." : "Increase limit"}
            </button>
          </div>
        );
      })}

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
    </div>
  );
}
