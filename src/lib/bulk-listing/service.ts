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
    status: String(row.status ?? "queued") as BulkListingJobStatus,
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
}): Promise<{ batchId: string; jobs: BulkListingJob[] }> {
  const validRows = input.rows
    .map((row, index) => ({
      productUrl: row.productUrl.trim(),
      platform: normalizePlatform(row.platform),
      profitPercent:
        row.profitPercent != null && Number.isFinite(Number(row.profitPercent))
          ? Number(row.profitPercent)
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
  ebaySettings: Partial<EbayAutoListingSettings>;
  amazefSettings: Partial<AmazefAutoListingSettings>;
}): Promise<{ processed: boolean; job: BulkListingJob | null; jobs: BulkListingJob[] }> {
  const supabase = getSupabaseAdmin();

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
  const startedAt = new Date().toISOString();

  await updateJob(job.id, { status: "listing", started_at: startedAt, error_message: null });

  let listingUrl: string | null = null;
  let listedTitle: string | null = null;
  let listedPrice: number | null = null;
  let currency: string | null = null;
  let errorMessage: string | null = null;
  let finalStatus: BulkListingJobStatus = "listed";

  try {
    if (job.platform === "amazef") {
      const settings = applyProfitOverride(
        normalizeAutoListingSettings(input.amazefSettings),
        job.profitPercent,
      );

      if (!settings.enabled) {
        throw new Error("Amazef auto listing is not enabled. Turn it on in AI Listing settings.");
      }

      const result = await runAmazefAutoListPipeline(input.userId, job.productUrl, settings, {
        acknowledgeVero: settings.listVeroProducts,
      });

      listingUrl = result.listingUrl;
      listedTitle = result.title;
      listedPrice = result.price;
      currency = result.currency;
    } else {
      const settings = applyProfitOverride(
        normalizeEbayAutoListingSettings(input.ebaySettings),
        job.profitPercent,
      );

      if (!settings.enabled) {
        throw new Error("eBay auto listing is not enabled. Turn it on in AI Listing settings.");
      }

      const result = await runEbayAutoListPipeline(input.userId, job.productUrl, settings, {
        acknowledgeVero: settings.listVeroProducts,
      });

      listingUrl = result.listingUrl;
      listedTitle = result.title;
      listedPrice = result.price;
      currency = result.currency;
    }
  } catch (error) {
    finalStatus = "failed";

    if (error instanceof EbayAutoListNeedsFulfillmentPolicyError) {
      errorMessage =
        "Shipping policy selection required. List this product manually on the AI Listing page.";
    } else if (error instanceof Error && error.message === "VERO_ACK_REQUIRED") {
      errorMessage =
        "VeRO product. Enable “List VeRO products” in auto listing settings or remove this URL.";
    } else {
      errorMessage = error instanceof Error ? error.message : "Listing failed.";
    }
  }

  const finishedAt = new Date().toISOString();

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
