import { NextRequest, NextResponse } from "next/server";
import { processDueCompetitorWatchUpdates } from "@/lib/competitors/service";

/**
 * Runs scheduled competitor watch checks (eBay/Amazef) for watches past next_update_at.
 * Call from an external cron (e.g. every hour), not from the browser.
 *
 * Set CRON_SECRET in .env.local and send: Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (cronSecret) {
      const auth = request.headers.get("authorization");
      if (auth !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
    }

    const processed = await processDueCompetitorWatchUpdates();

    return NextResponse.json({ success: true, processed });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process due competitor watches.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
