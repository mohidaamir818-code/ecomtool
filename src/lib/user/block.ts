import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { UserBlockStatus } from "@/types/user-block";

export class UserBlockedError extends Error {
  readonly code = "account_blocked" as const;
  readonly reason: string;

  constructor(reason: string) {
    super(`Account blocked: ${reason}`);
    this.name = "UserBlockedError";
    this.reason = reason;
  }
}

export function userBlockedToJson(error: UserBlockedError) {
  return {
    error: error.code,
    message: "Your account has been blocked.",
    reason: error.reason,
  };
}

export async function getUserBlockStatus(userId: string): Promise<UserBlockStatus> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("is_blocked, blocked_reason, blocked_at")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return { blocked: false, reason: null, blockedAt: null };
  }

  return {
    blocked: Boolean(data.is_blocked),
    reason: data.blocked_reason ? String(data.blocked_reason) : null,
    blockedAt: data.blocked_at ? String(data.blocked_at) : null,
  };
}

export async function assertUserNotBlocked(userId: string): Promise<void> {
  const status = await getUserBlockStatus(userId);
  if (status.blocked) {
    throw new UserBlockedError(status.reason ?? "Contact support for assistance.");
  }
}

export async function blockUser(
  userId: string,
  reason: string,
  adminEmail: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update({
      is_blocked: true,
      blocked_reason: reason.trim(),
      blocked_at: now,
      blocked_by: adminEmail,
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

export async function unblockUser(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("profiles")
    .update({
      is_blocked: false,
      blocked_reason: null,
      blocked_at: null,
      blocked_by: null,
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}
