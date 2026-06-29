import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { runBulkListingWave } from "@/lib/bulk-listing/service";
import { triggerBulkListingWorker } from "@/lib/bulk-listing/trigger";

export const dynamic = "force-dynamic";
// Hobby plan caps function duration; keep each wave short and chain instead.
export const maxDuration = 60;

function verifyCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

export async function POST(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    // Process a single wave within the function time budget, then re-trigger
    // the worker if jobs remain. This drains an entire batch server-side on the
    // Hobby plan without needing a sub-daily cron.
    const { processed, remaining } = await runBulkListingWave(45_000);

    if (remaining > 0) {
      after(() => triggerBulkListingWorker());
    }

    return NextResponse.json({ success: true, processed, remaining });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process bulk listing.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
