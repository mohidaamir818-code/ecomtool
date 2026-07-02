import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { resolveVeroHold, resolveVeroHolds } from "@/lib/bulk-listing/service";
import { triggerBulkListingWorker } from "@/lib/bulk-listing/trigger";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      jobId?: string;
      approve?: boolean;
    };

    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const approve = Boolean(body.approve);
    const jobId = body.jobId?.trim();
    const jobs = jobId
      ? await resolveVeroHold(userId, jobId, approve)
      : await resolveVeroHolds(userId, approve);

    // Approved VeRO jobs go back to the queue — kick the worker to list them.
    if (approve) {
      after(() => triggerBulkListingWorker());
    }

    return NextResponse.json({ success: true, jobs });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;
    const message = error instanceof Error ? error.message : "Failed to update VeRO products.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
