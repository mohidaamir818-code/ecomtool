import { NextRequest, NextResponse } from "next/server";
import {
  getUserBulkListingJobs,
  resetFailedJobsForRetry,
  resetJobForRetry,
} from "@/lib/bulk-listing/service";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      jobId?: string;
      allFailed?: boolean;
    };

    const userId = body.userId?.trim();
    const jobId = body.jobId?.trim();

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    if (body.allFailed) {
      const count = await resetFailedJobsForRetry(userId);
      const jobs = await getUserBulkListingJobs(userId);
      return NextResponse.json({ success: true, retriedCount: count, jobs });
    }

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required." }, { status: 400 });
    }

    const job = await resetJobForRetry(jobId, userId);
    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const jobs = await getUserBulkListingJobs(userId);
    return NextResponse.json({ success: true, job, jobs });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;
    const message = error instanceof Error ? error.message : "Failed to retry job.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
