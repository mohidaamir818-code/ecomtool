import { NextRequest, NextResponse } from "next/server";
import { processNextBulkListingJob } from "@/lib/bulk-listing/service";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      ebaySettings?: Record<string, unknown>;
      amazefSettings?: Record<string, unknown>;
    };

    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const result = await processNextBulkListingJob({
      userId,
      ebaySettings: body.ebaySettings ?? {},
      amazefSettings: body.amazefSettings ?? {},
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;
    const message = error instanceof Error ? error.message : "Failed to process bulk listing job.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
