import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import {
  createBulkListingBatch,
  getUserBulkListingJobs,
} from "@/lib/bulk-listing/service";
import { triggerBulkListingWorker } from "@/lib/bulk-listing/trigger";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type { BulkListingRowInput } from "@/types/bulk-listing";
import type { ListingPlatform } from "@/types/listing-generator";

export const dynamic = "force-dynamic";

function normalizePlatform(value: unknown): ListingPlatform {
  return value === "amazef" ? "amazef" : "ebay";
}

function normalizeRows(raw: unknown): BulkListingRowInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => ({
    productUrl: String((row as BulkListingRowInput)?.productUrl ?? "").trim(),
    platform: normalizePlatform((row as BulkListingRowInput)?.platform),
    profitPercent:
      (row as BulkListingRowInput)?.profitPercent != null
        ? Number((row as BulkListingRowInput).profitPercent)
        : null,
    fixedPrice:
      (row as BulkListingRowInput)?.fixedPrice != null
        ? Number((row as BulkListingRowInput).fixedPrice)
        : null,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const jobs = await getUserBulkListingJobs(userId);
    return NextResponse.json({ success: true, jobs });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;
    const message = error instanceof Error ? error.message : "Failed to load bulk listing jobs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      rows?: unknown;
      ebaySettings?: Record<string, unknown>;
      amazefSettings?: Record<string, unknown>;
    };

    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const rows = normalizeRows(body.rows);
    const { batchId, jobs } = await createBulkListingBatch({
      userId,
      rows,
      ebaySettings: body.ebaySettings,
      amazefSettings: body.amazefSettings,
    });

    // Kick the server-side worker so the batch keeps listing even if the seller
    // closes the tab. The worker chains itself in waves until the queue drains.
    after(() => triggerBulkListingWorker());

    return NextResponse.json({ success: true, batchId, jobs }, { status: 201 });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;
    const message = error instanceof Error ? error.message : "Failed to start bulk listing.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
