import "server-only";

import { randomUUID } from "crypto";
import {
  normalizeAutoListingSettings,
  type AmazefAutoListingSettings,
} from "@/features/listings/lib/amazef-auto-listing";
import {
  normalizeEbayAutoListingSettings,
  type EbayAutoListingSettings,
} from "@/features/listings/lib/ebay-auto-listing";
import { runAmazefAutoListPipeline } from "@/lib/amazef/auto-list-pipeline";
import {
  EbayAutoListNeedsFulfillmentPolicyError,
  runEbayAutoListPipeline,
} from "@/lib/ebay/auto-list-pipeline";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  BulkListingJob,
  BulkListingJobStatus,
  BulkListingRowInput,
} from "@/types/bulk-listing";
import type { ListingPlatform } from "@/types/listing-generator";

const MAX_ROWS_PER_BATCH = 50;
const ALIEXPRESS_URL_PATTERN = /aliexpress\./i;

function mapJobRow(row: Record<string, unknown>): BulkListingJob {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    batchId: String(row.batch_id),
    productUrl: String(row.product_url),
    platform: (row.platform === "amazef" ? "amazef" : "ebay") as ListingPlatform,
    profitPercent: row.profit_percent != null ? Number(row.profit_percent) : null,
    fixedPrice: row.fixed_price != null ? Number(row.fixed_price) : null,
    status: String(row.status ?? "queued") as BulkListingJobStatus,
    veroAck: Boolean(row.vero_ack),
    errorMessage: row.error_message ? String(row.error_message) : null,
    listingUrl: row.listing_url ? String(row.listing_url) : null,
    listedTitle: row.listed_title ? String(row.listed_title) : null,
    listedPrice: row.listed_price != null ? Number(row.listed_price) : null,
    currency: row.currency ? String(row.currency) : null,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    startedAt: row.started_at ? String(row.started_at) : null,
    finishedAt: row.finished_at ? String(row.finished_at) : null,
  };
}

function normalizePlatform(value: unknown): ListingPlatform {
  return value === "amazef" ? "amazef" : "ebay";
}

function isValidAliExpressUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return ALIEXPRESS_URL_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
}

function applyProfitOverride<T extends { minProfitPercent: number; maxProfitPercent: number }>(
  settings: T,
  profitPercent: number | null | undefined,
): T {
  if (profitPercent == null || !Number.isFinite(profitPercent)) return settings;
  const clamped = Math.min(95, Math.max(1, profitPercent));
  return { ...settings, minProfitPercent: clamped, maxProfitPercent: clamped };
}

export async function getUserBulkListingJobs(userId: string): Promise<BulkListingJob[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bulk_listing_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapJobRow(row as Record<string, unknown>));
}

export async function createBulkListingBatch(input: {
  userId: string;
  rows: BulkListingRowInput[];
  ebaySettings?: Partial<EbayAutoListingSettings>;
  amazefSettings?: Partial<AmazefAutoListingSettings>;
}): Promise<{ batchId: string; jobs: BulkListingJob[] }> {
  // Snapshot the seller's settings so the server can keep listing even after the
  // browser tab is closed (no client involvement needed afterwards).
  const ebaySnapshot = normalizeEbayAutoListingSettings(input.ebaySettings ?? null);
  const amazefSnapshot = normalizeAutoListingSettings(input.amazefSettings ?? null);

  const validRows = input.rows
    .map((row, index) => ({
      productUrl: row.productUrl.trim(),
      platform: normalizePlatform(row.platform),
      profitPercent:
        row.profitPercent != null && Number.isFinite(Number(row.profitPercent))
          ? Number(row.profitPercent)
          : null,
      fixedPrice:
        row.fixedPrice != null && Number.isFinite(Number(row.fixedPrice)) && Number(row.fixedPrice) > 0
          ? Number(row.fixedPrice)
          : null,
      sortOrder: index,
    }))
    .filter((row) => row.productUrl.length > 0);

  if (validRows.length === 0) {
    throw new Error("Add at least one AliExpress URL.");
  }

  if (validRows.length > MAX_ROWS_PER_BATCH) {
    throw new Error(`You can list up to ${MAX_ROWS_PER_BATCH} products at once.`);
  }

  for (const row of validRows) {
    if (!isValidAliExpressUrl(row.productUrl)) {
      throw new Error(`Invalid AliExpress URL: ${row.productUrl}`);
    }
  }

  const batchId = randomUUID();
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const inserts = validRows.map((row) => ({
    user_id: input.userId,
    batch_id: batchId,
    product_url: row.productUrl,
    platform: row.platform,
    profit_percent: row.profitPercent,
    fixed_price: row.fixedPrice,
    settings: row.platform === "amazef" ? amazefSnapshot : ebaySnapshot,
    status: "queued",
    sort_order: row.sortOrder,
    created_at: now,
    updated_at: now,
  }));

  const { data, error } = await supabase.from("bulk_listing_jobs").insert(inserts).select("*");

  if (error) {
    if (error.message.includes("does not exist")) {
      throw new Error("Run supabase/migrations/025_bulk_listing_jobs.sql in Supabase.");
    }
    throw new Error(error.message);
  }

  return {
    batchId,
    jobs: (data ?? []).map((row) => mapJobRow(row as Record<string, unknown>)),
  };
}

async function updateJob(
  jobId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("bulk_listing_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

export async function resetJobForRetry(jobId: string, userId: string): Promise<BulkListingJob | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("bulk_listing_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;

  const { data: updated, error } = await supabase
    .from("bulk_listing_jobs")
    .update({
      status: "queued",
      error_message: null,
      listing_url: null,
      listed_title: null,
      listed_price: null,
      currency: null,
      started_at: null,
      finished_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapJobRow(updated as Record<string, unknown>);
}

export async function processNextBulkListingJob(input: {
  userId: string;
  ebaySettings?: Partial<EbayAutoListingSettings>;
  amazefSettings?: Partial<AmazefAutoListingSettings>;
}): Promise<{ processed: boolean; job: BulkListingJob | null; jobs: BulkListingJob[] }> {
  const supabase = getSupabaseAdmin();

  // Non-VeRO products are listed first; VeRO products are parked as 'vero_hold'
  // and only resume once the seller approves them, so they naturally go last.
  const { data: nextRow, error: fetchError } = await supabase
    .from("bulk_listing_jobs")
    .select("*")
    .eq("user_id", input.userId)
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    if (fetchError.message.includes("does not exist")) {
      return { processed: false, job: null, jobs: [] };
    }
    throw new Error(fetchError.message);
  }

  if (!nextRow) {
    const jobs = await getUserBulkListingJobs(input.userId);
    return { processed: false, job: null, jobs };
  }

  const job = mapJobRow(nextRow as Record<string, unknown>);
  const storedSettings = (nextRow as Record<string, unknown>).settings as
    | Record<string, unknown>
    | null;
  const startedAt = new Date().toISOString();

  // Atomically claim the job so a concurrent worker (client + cron) can't double-list.
  const { data: claimed } = await supabase
    .from("bulk_listing_jobs")
    .update({ status: "listing", started_at: startedAt, error_message: null, updated_at: startedAt })
    .eq("id", job.id)
    .eq("status", "queued")
    .select("id");

  if (!claimed || claimed.length === 0) {
    // Another worker grabbed it first — let the loop move on to the next job.
    const jobs = await getUserBulkListingJobs(input.userId);
    return { processed: true, job: null, jobs };
  }

  let listingUrl: string | null = null;
  let listedTitle: string | null = null;
  let listedPrice: number | null = null;
  let currency: string | null = null;
  let errorMessage: string | null = null;
  let finalStatus: BulkListingJobStatus = "listed";

  try {
    // A fixed price takes precedence over a profit % override.
    const useFixedPrice = job.fixedPrice != null && job.fixedPrice > 0;
    const profitOverride = useFixedPrice ? null : job.profitPercent;

    if (job.platform === "amazef") {
      const settings = applyProfitOverride(
        normalizeAutoListingSettings(storedSettings ?? input.amazefSettings ?? null),
        profitOverride,
      );

      if (!settings.enabled) {
        throw new Error("Amazef auto listing is not enabled. Turn it on in AI Listing settings.");
      }

      const result = await runAmazefAutoListPipeline(input.userId, job.productUrl, settings, {
        acknowledgeVero: job.veroAck,
        manualPriceOverride: useFixedPrice ? job.fixedPrice : null,
      });

      listingUrl = result.listingUrl;
      listedTitle = result.title;
      listedPrice = result.price;
      currency = result.currency;
    } else {
      const settings = applyProfitOverride(
        normalizeEbayAutoListingSettings(storedSettings ?? input.ebaySettings ?? null),
        profitOverride,
      );

      if (!settings.enabled) {
        throw new Error("eBay auto listing is not enabled. Turn it on in AI Listing settings.");
      }

      const result = await runEbayAutoListPipeline(input.userId, job.productUrl, settings, {
        acknowledgeVero: job.veroAck,
        manualPriceOverride: useFixedPrice ? job.fixedPrice : null,
      });

      listingUrl = result.listingUrl;
      listedTitle = result.title;
      listedPrice = result.price;
      currency = result.currency;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "VERO_ACK_REQUIRED") {
      // VeRO listing is allowed in settings but needs the seller's explicit OK.
      // Park it and ask for permission at the end.
      finalStatus = "vero_hold";
      errorMessage = null;
    } else if (error instanceof EbayAutoListNeedsFulfillmentPolicyError) {
      finalStatus = "failed";
      errorMessage =
        "Shipping policy selection required. List this product manually on the AI Listing page.";
    } else {
      finalStatus = "failed";
      errorMessage = error instanceof Error ? error.message : "Listing failed.";
    }
  }

  const finishedAt = finalStatus === "vero_hold" ? null : new Date().toISOString();

  await updateJob(job.id, {
    status: finalStatus,
    error_message: errorMessage,
    listing_url: listingUrl,
    listed_title: listedTitle,
    listed_price: listedPrice,
    currency,
    finished_at: finishedAt,
  });

  const jobs = await getUserBulkListingJobs(input.userId);
  const updatedJob = jobs.find((item) => item.id === job.id) ?? null;

  return { processed: true, job: updatedJob, jobs };
}

/**
 * Resolves all parked VeRO products for a user: approve lists them (with the
 * seller's acknowledgement), decline marks them failed.
 */
export async function resolveVeroHolds(
  userId: string,
  approve: boolean,
): Promise<BulkListingJob[]> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (approve) {
    await supabase
      .from("bulk_listing_jobs")
      .update({ status: "queued", vero_ack: true, error_message: null, updated_at: now })
      .eq("user_id", userId)
      .eq("status", "vero_hold");
  } else {
    await supabase
      .from("bulk_listing_jobs")
      .update({
        status: "failed",
        error_message: "VeRO listing skipped by seller.",
        finished_at: now,
        updated_at: now,
      })
      .eq("user_id", userId)
      .eq("status", "vero_hold");
  }

  return getUserBulkListingJobs(userId);
}

/**
 * Server-side batch processor used by the cron so listings continue even after
 * the seller closes the tab. Uses each job's stored settings snapshot.
 */
export async function processDueBulkListingJobs(maxJobs = 15): Promise<number> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("bulk_listing_jobs")
    .select("user_id")
    .eq("status", "queued")
    .limit(500);

  if (error) {
    if (error.message.includes("does not exist")) return 0;
    throw new Error(error.message);
  }

  const userIds = [...new Set((data ?? []).map((row) => String(row.user_id)))];
  let processed = 0;

  for (const userId of userIds) {
    for (let i = 0; i < maxJobs; i += 1) {
      const result = await processNextBulkListingJob({ userId });
      if (!result.processed) break;
      processed += 1;
    }
  }

  return processed;
}

export async function countQueuedBulkListingJobs(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("bulk_listing_jobs")
    .select("*", { count: "exact", head: true })
    .eq("status", "queued");

  if (error) {
    if (error.message.includes("does not exist")) return 0;
    throw new Error(error.message);
  }
  return count ?? 0;
}

async function processOneQueuedJobAnyUser(): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("bulk_listing_jobs")
    .select("user_id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data?.user_id) return false;

  const result = await processNextBulkListingJob({ userId: String(data.user_id) });
  return result.processed;
}

/**
 * Processes queued jobs until the time budget runs out. The worker route calls
 * this in waves and re-triggers itself while jobs remain, so a whole store keeps
 * listing within short Hobby-plan function limits — no client tab required.
 */
export async function runBulkListingWave(
  budgetMs = 45_000,
): Promise<{ processed: number; remaining: number }> {
  const start = Date.now();
  let processed = 0;

  while (Date.now() - start < budgetMs) {
    const didWork = await processOneQueuedJobAnyUser();
    if (!didWork) break;
    processed += 1;
  }

  const remaining = await countQueuedBulkListingJobs();
  return { processed, remaining };
}
