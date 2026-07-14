import { NextRequest, NextResponse } from "next/server";
import { markBulkJobListed } from "@/lib/bulk-listing/service";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      jobId?: string;
      listingUrl?: string | null;
      listedTitle?: string;
      listedPrice?: number;
      currency?: string;
    };

    const userId = body.userId?.trim();
    const jobId = body.jobId?.trim();

    if (!userId || !jobId) {
      return NextResponse.json({ error: "userId and jobId are required." }, { status: 400 });
    }

    if (!body.listedTitle?.trim()) {
      return NextResponse.json({ error: "listedTitle is required." }, { status: 400 });
    }

    if (body.listedPrice == null || !Number.isFinite(body.listedPrice)) {
      return NextResponse.json({ error: "listedPrice is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const jobs = await markBulkJobListed({
      userId,
      jobId,
      listingUrl: body.listingUrl ?? null,
      listedTitle: body.listedTitle.trim(),
      listedPrice: body.listedPrice,
      currency: body.currency?.trim() || "GBP",
    });

    return NextResponse.json({ success: true, jobs });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;
    const message = error instanceof Error ? error.message : "Failed to update bulk listing job.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
