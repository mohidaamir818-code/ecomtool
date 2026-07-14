import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";

export interface AutoSyncSettings {
  /** When true, marketplace stock is set to 0 when AliExpress stock hits 0. */
  autoSyncStock: boolean;
  /** When true, marketplace price is raised when AliExpress price rises. */
  autoSyncPrice: boolean;
  /**
   * When true, email the seller about stock/price changes —
   * including when sync is OFF (notify only, no marketplace revise).
   */
  autoSyncNotify: boolean;
}

export const DEFAULT_AUTO_SYNC_SETTINGS: AutoSyncSettings = {
  autoSyncStock: false,
  autoSyncPrice: false,
  autoSyncNotify: true,
};

export function normalizeAutoSyncSettings(
  input: Partial<AutoSyncSettings> | null | undefined,
): AutoSyncSettings {
  if (!input) return { ...DEFAULT_AUTO_SYNC_SETTINGS };
  return {
    autoSyncStock: Boolean(input.autoSyncStock),
    autoSyncPrice: Boolean(input.autoSyncPrice),
    autoSyncNotify:
      input.autoSyncNotify === undefined
        ? DEFAULT_AUTO_SYNC_SETTINGS.autoSyncNotify
        : Boolean(input.autoSyncNotify),
  };
}

export async function getAutoSyncSettings(userId: string): Promise<AutoSyncSettings> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("auto_sync_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (error.message.includes("does not exist")) {
      return { ...DEFAULT_AUTO_SYNC_SETTINGS };
    }
    throw new Error(error.message);
  }

  if (!data) return { ...DEFAULT_AUTO_SYNC_SETTINGS };

  return normalizeAutoSyncSettings({
    autoSyncStock: Boolean((data as Record<string, unknown>).auto_sync_stock),
    autoSyncPrice: Boolean((data as Record<string, unknown>).auto_sync_price),
    autoSyncNotify: Boolean((data as Record<string, unknown>).auto_sync_notify),
  });
}

export async function saveAutoSyncSettings(
  userId: string,
  settings: Partial<AutoSyncSettings>,
): Promise<AutoSyncSettings> {
  const next = normalizeAutoSyncSettings(settings);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("auto_sync_settings").upsert(
    {
      user_id: userId,
      auto_sync_stock: next.autoSyncStock,
      auto_sync_price: next.autoSyncPrice,
      auto_sync_notify: next.autoSyncNotify,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    if (error.message.includes("does not exist")) {
      throw new Error("Run supabase/migrations/032_auto_sync_settings.sql in Supabase.");
    }
    throw new Error(error.message);
  }

  return next;
}
