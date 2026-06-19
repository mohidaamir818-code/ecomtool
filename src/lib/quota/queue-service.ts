import "server-only";

import { checkCompetitorWatchUpdate } from "@/lib/competitors/service";
import { checkHandlingProductUpdate } from "@/lib/handling/service";
import { getTodayUtcDate, getTomorrowUtcDate } from "@/lib/quota/errors";
import { consumeQuota, getPlatformQuota } from "@/lib/quota/service";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { QueueItem, QueuePlatform } from "@/types/quota";

function mapQueueRow(row: Record<string, unknown>): QueueItem {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    platform: row.platform as QueuePlatform,
    itemIds: Array.isArray(row.item_ids) ? row.item_ids.map(String) : [],
    scheduledFor: String(row.scheduled_for),
    status: row.status as QueueItem["status"],
    processedCount: Number(row.processed_count ?? 0),
    totalCount: Number(row.total_count ?? 0),
    progressMessage: row.progress_message ? String(row.progress_message) : null,
    createdAt: String(row.created_at),
  };
}

export async function enqueueOverflow(
  userId: string,
  platform: QueuePlatform,
  itemIds: string[],
  scheduledFor?: string,
  progressMessage?: string,
): Promise<QueueItem | null> {
  if (itemIds.length === 0) return null;

  const supabase = getSupabaseAdmin();
  const date = scheduledFor ?? getTomorrowUtcDate();
  const message =
    progressMessage ?? `Day 1 complete — ${itemIds.length} remaining for tomorrow`;

  const { data: existing } = await supabase
    .from("request_queue")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("scheduled_for", date)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    const mergedIds = Array.from(
      new Set([...(existing.item_ids as string[]), ...itemIds]),
    );

    const { data: updated, error } = await supabase
      .from("request_queue")
      .update({
        item_ids: mergedIds,
        total_count: mergedIds.length,
        progress_message: `Day 1 complete — ${mergedIds.length} remaining for tomorrow`,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return mapQueueRow(updated);
  }

  const { data, error } = await supabase
    .from("request_queue")
    .insert({
      user_id: userId,
      platform,
      item_ids: itemIds,
      scheduled_for: date,
      status: "pending",
      processed_count: 0,
      total_count: itemIds.length,
      progress_message: message,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapQueueRow(data);
}

export async function getUserQueue(userId: string): Promise<QueueItem[]> {
  const supabase = getSupabaseAdmin();
  const today = getTodayUtcDate();

  const { data, error } = await supabase
    .from("request_queue")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["pending", "processing"])
    .gte("scheduled_for", today)
    .order("scheduled_for", { ascending: true });

  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map(mapQueueRow);
}

export async function processDueQueueItems(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const today = getTodayUtcDate();

  const { data, error } = await supabase
    .from("request_queue")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", today)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    if (error.message.includes("does not exist")) return 0;
    throw new Error(error.message);
  }

  let totalProcessed = 0;

  for (const row of data ?? []) {
    const item = mapQueueRow(row);
    const quotaPlatform = item.platform === "ebay" ? "ebay" : "aliexpress";
    const quota = await getPlatformQuota(item.userId, quotaPlatform);
    const remaining = quota.remaining ?? 0;

    if (remaining <= 0) continue;

    const idsToProcess = item.itemIds.slice(0, remaining);
    const leftover = item.itemIds.slice(remaining);

    let processed = 0;
    await supabase.from("request_queue").update({ status: "processing" }).eq("id", item.id);

    for (const itemId of idsToProcess) {
      try {
        await consumeQuota(item.userId, quotaPlatform, 1);
        if (item.platform === "ebay") {
          await checkCompetitorWatchUpdate(item.userId, itemId, { skipQuota: true });
        } else {
          await checkHandlingProductUpdate(item.userId, itemId, { skipQuota: true });
        }
        processed += 1;
      } catch {
        leftover.unshift(itemId);
      }
    }

    if (leftover.length > 0) {
      await enqueueOverflow(
        item.userId,
        item.platform,
        leftover,
        getTomorrowUtcDate(),
        `Day 1 complete — ${leftover.length} remaining for tomorrow`,
      );
    }

    await supabase
      .from("request_queue")
      .update({
        status: "completed",
        processed_count: item.processedCount + processed,
        item_ids: [],
        progress_message:
          leftover.length > 0
            ? `${processed} processed — ${leftover.length} remaining for tomorrow`
            : "Queue batch completed.",
      })
      .eq("id", item.id);

    totalProcessed += processed;
  }

  return totalProcessed;
}

export async function addToQueue(
  userId: string,
  platform: QueuePlatform,
  itemIds: string[],
  scheduledFor?: string,
): Promise<QueueItem | null> {
  return enqueueOverflow(userId, platform, itemIds, scheduledFor);
}
