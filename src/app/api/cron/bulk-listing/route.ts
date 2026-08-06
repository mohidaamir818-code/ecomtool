import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { triggerBulkListingWorker } from "@/lib/bulk-listing/trigger";

export const dynamic = "force-dynamic";
// Hobby plan caps function duration; each chained wave stays under this budget.
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
    // Kick an in-process wave (and chained follow-ups) so queued jobs do not sit idle.
    // Do this in `after()` so the cron HTTP response returns quickly.
    after(() => triggerBulkListingWorker());

    return NextResponse.json({ success: true, started: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process bulk listing.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
