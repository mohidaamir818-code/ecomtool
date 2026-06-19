import "server-only";

import {
  ALL_PLATFORMS,
  DEFAULT_DAILY_LIMITS,
  QUOTA_EXCEEDED_MESSAGE,
} from "@/lib/quota/constants";
import { getNextUtcMidnightIso, QuotaExceededError } from "@/lib/quota/errors";
import { sendEmail } from "@/lib/email/send-email";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { PlatformQuota, QuotaPlatform, UserQuotasResponse } from "@/types/quota";
import { PLATFORM_LABELS } from "@/lib/quota/constants";

interface QuotaRow {
  platform: string;
  daily_limit: number | null;
  used_today: number;
  total_used: number;
  last_reset_at: string;
  updated_by: string | null;
  updated_at: string;
}

function mapQuotaRow(row: QuotaRow): PlatformQuota {
  const platform = row.platform as QuotaPlatform;
  const unlimited = row.daily_limit === null;
  const remaining =
    unlimited || row.daily_limit === null
      ? null
      : Math.max(row.daily_limit - row.used_today, 0);

  return {
    platform,
    dailyLimit: row.daily_limit,
    usedToday: row.used_today,
    totalUsed: Number(row.total_used),
    remaining,
    lastResetAt: row.last_reset_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    unlimited,
  };
}

export async function ensureUserQuotas(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  for (const platform of ALL_PLATFORMS) {
    const { data: existing } = await supabase
      .from("user_quotas")
      .select("id")
      .eq("user_id", userId)
      .eq("platform", platform)
      .maybeSingle();

    if (existing) continue;

    await supabase.from("user_quotas").insert({
      user_id: userId,
      platform,
      daily_limit: DEFAULT_DAILY_LIMITS[platform],
      used_today: 0,
      total_used: 0,
      last_reset_at: now,
      updated_by: "system",
      updated_at: now,
    });
  }
}

export async function getUserQuotas(userId: string): Promise<UserQuotasResponse> {
  await ensureUserQuotas(userId);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("get_user_quotas", { p_user_id: userId });

  if (error) {
    if (error.message.includes("does not exist")) {
      const { data: rows } = await supabase
        .from("user_quotas")
        .select("*")
        .eq("user_id", userId);

      const quotas = (rows ?? []).map((row) =>
        mapQuotaRow({
          platform: String(row.platform),
          daily_limit: row.daily_limit === null ? null : Number(row.daily_limit),
          used_today: Number(row.used_today ?? 0),
          total_used: Number(row.total_used ?? 0),
          last_reset_at: String(row.last_reset_at),
          updated_by: row.updated_by ? String(row.updated_by) : null,
          updated_at: String(row.updated_at),
        }),
      );

      return { quotas, resetsAt: getNextUtcMidnightIso() };
    }
    throw new Error(error.message);
  }

  const quotas = (data ?? []).map((row: QuotaRow) => mapQuotaRow(row));
  return { quotas, resetsAt: getNextUtcMidnightIso() };
}

export async function getPlatformQuota(
  userId: string,
  platform: QuotaPlatform,
): Promise<PlatformQuota> {
  const { quotas } = await getUserQuotas(userId);
  const quota = quotas.find((item) => item.platform === platform);
  if (!quota) {
    throw new Error(`Quota not found for platform: ${platform}`);
  }
  return quota;
}

export async function getRemaining(userId: string, platform: QuotaPlatform): Promise<number | null> {
  const quota = await getPlatformQuota(userId, platform);
  return quota.remaining;
}

export async function consumeQuota(
  userId: string,
  platform: QuotaPlatform,
  count = 1,
): Promise<PlatformQuota> {
  if (count <= 0) {
    return getPlatformQuota(userId, platform);
  }

  await ensureUserQuotas(userId);
  const supabase = getSupabaseAdmin();

  const { data: row, error: fetchError } = await supabase
    .from("user_quotas")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform)
    .single();

  if (fetchError || !row) {
    throw new Error(fetchError?.message ?? "Quota row not found.");
  }

  const dailyLimit = row.daily_limit === null ? null : Number(row.daily_limit);
  const usedToday = Number(row.used_today ?? 0);
  const totalUsed = Number(row.total_used ?? 0);
  const resetsAt = getNextUtcMidnightIso();

  if (dailyLimit !== null && usedToday + count > dailyLimit) {
    throw new QuotaExceededError({
      platform,
      used: usedToday,
      limit: dailyLimit,
      remaining: Math.max(dailyLimit - usedToday, 0),
      resetsAt,
      message: QUOTA_EXCEEDED_MESSAGE,
    });
  }

  const { data: updated, error: updateError } = await supabase
    .from("user_quotas")
    .update({
      used_today: usedToday + count,
      total_used: totalUsed + count,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("platform", platform)
    .select("*")
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? "Failed to update quota.");
  }

  return mapQuotaRow({
    platform: String(updated.platform),
    daily_limit: updated.daily_limit === null ? null : Number(updated.daily_limit),
    used_today: Number(updated.used_today ?? 0),
    total_used: Number(updated.total_used ?? 0),
    last_reset_at: String(updated.last_reset_at),
    updated_by: updated.updated_by ? String(updated.updated_by) : null,
    updated_at: String(updated.updated_at),
  });
}

export async function resetAllDailyQuotas(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("user_quotas")
    .update({
      used_today: 0,
      last_reset_at: now,
      updated_at: now,
    })
    .neq("used_today", 0)
    .select("id");

  if (error) {
    if (error.message.includes("does not exist")) return 0;
    throw new Error(error.message);
  }

  return data?.length ?? 0;
}

export async function increaseDailyLimit(
  userId: string,
  platform: QuotaPlatform,
  newLimit: number | null,
  adminEmail: string,
  userEmail: string,
): Promise<{ oldLimit: number | null; newLimit: number | null }> {
  await ensureUserQuotas(userId);

  const supabase = getSupabaseAdmin();
  const { data: existing, error: fetchError } = await supabase
    .from("user_quotas")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform)
    .single();

  if (fetchError || !existing) {
    throw new Error(fetchError?.message ?? "Quota row not found.");
  }

  const oldLimit = existing.daily_limit === null ? null : Number(existing.daily_limit);
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("user_quotas")
    .update({
      daily_limit: newLimit,
      updated_by: adminEmail,
      updated_at: now,
    })
    .eq("user_id", userId)
    .eq("platform", platform);

  if (updateError) throw new Error(updateError.message);

  const label = PLATFORM_LABELS[platform];
  const oldLabel = oldLimit === null ? "Unlimited" : String(oldLimit);
  const newLabel = newLimit === null ? "Unlimited" : String(newLimit);

  await sendEmail({
    to: userEmail,
    subject: "Your Request Limit Has Been Increased! 🎉",
    text: [
      `Great news! Your ${label} request limit has been increased from ${oldLabel} to ${newLabel}.`,
      "",
      "You can now process more products. Happy selling! 🚀",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111827;">Your Request Limit Has Been Increased! 🎉</h2>
        <p style="color: #374151; line-height: 1.6;">
          Great news! Your <strong>${label}</strong> request limit has been increased
          from <strong>${oldLabel}</strong> to <strong>${newLabel}</strong>.
        </p>
        <p style="color: #374151; line-height: 1.6;">
          You can now process more products. Happy selling! 🚀
        </p>
      </div>
    `,
  });

  return { oldLimit, newLimit };
}

export function quotaExceededToJson(error: QuotaExceededError) {
  return {
    error: error.code,
    message: error.message,
    platform: error.platform,
    used: error.used,
    limit: error.limit,
    remaining: error.remaining,
    resetsAt: error.resetsAt,
  };
}
