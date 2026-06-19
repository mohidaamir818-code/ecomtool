"use client";

import { useCallback, useEffect, useState } from "react";
import { PLATFORM_LABELS } from "@/lib/quota/constants";
import { QuotaCard } from "@/features/quota/components/QuotaCard";
import { LimitReachedBanner } from "@/features/quota/components/LimitReachedBanner";
import type { PlatformQuota, QuotaPlatform, UserQuotasResponse } from "@/types/quota";

export function PlatformQuotaWidget({
  userId,
  platform,
  variant = "light",
  showBanner = true,
}: {
  userId: string | null;
  platform: QuotaPlatform;
  variant?: "light" | "dark";
  showBanner?: boolean;
}) {
  const [data, setData] = useState<UserQuotasResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/quota/${encodeURIComponent(userId)}`);
      if (!response.ok) return;
      const payload = (await response.json()) as UserQuotasResponse & { success?: boolean };
      setData({ quotas: payload.quotas, resetsAt: payload.resetsAt });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (!userId || loading) {
    return (
      <div
        className={`h-28 animate-pulse rounded-xl ${
          variant === "dark" ? "bg-white/5" : "bg-gray-100"
        }`}
      />
    );
  }

  const quota = data?.quotas.find((item) => item.platform === platform);
  if (!quota || !data) return null;

  const limitReached = !quota.unlimited && (quota.remaining ?? 0) <= 0;

  return (
    <div className="space-y-3">
      <QuotaCard quota={quota} resetsAt={data.resetsAt} variant={variant} />
      {showBanner && limitReached ? (
        <LimitReachedBanner resetsAt={data.resetsAt} />
      ) : null}
      {!quota.unlimited && !limitReached ? (
        <p className={`text-xs ${variant === "dark" ? "text-white/50" : "text-gray-500"}`}>
          {PLATFORM_LABELS[platform]}: {quota.remaining} of {quota.dailyLimit} requests left today
        </p>
      ) : null}
    </div>
  );
}

export function usePlatformQuota(userId: string | null, platform: QuotaPlatform) {
  const [quota, setQuota] = useState<PlatformQuota | null>(null);
  const [resetsAt, setResetsAt] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/quota/${encodeURIComponent(userId)}`);
      if (!response.ok) return;
      const payload = (await response.json()) as UserQuotasResponse;
      setQuota(payload.quotas.find((item) => item.platform === platform) ?? null);
      setResetsAt(payload.resetsAt);
    } finally {
      setLoading(false);
    }
  }, [userId, platform]);

  useEffect(() => {
    void reload();
    const id = window.setInterval(() => void reload(), 30_000);
    return () => window.clearInterval(id);
  }, [reload]);

  const limitReached = quota ? !quota.unlimited && (quota.remaining ?? 0) <= 0 : false;

  return { quota, resetsAt, loading, limitReached, reload };
}

export function useUserQueue(userId: string | null) {
  const [messages, setMessages] = useState<string[]>([]);

  const reload = useCallback(async () => {
    if (!userId) return;
    const response = await fetch(`/api/queue/${encodeURIComponent(userId)}`);
    if (!response.ok) return;
    const payload = (await response.json()) as {
      queue?: Array<{ progressMessage: string | null }>;
    };
    setMessages(
      (payload.queue ?? [])
        .map((item) => item.progressMessage)
        .filter((msg): msg is string => Boolean(msg)),
    );
  }, [userId]);

  useEffect(() => {
    void reload();
    const id = window.setInterval(() => void reload(), 30_000);
    return () => window.clearInterval(id);
  }, [reload]);

  return { messages, reload };
}
