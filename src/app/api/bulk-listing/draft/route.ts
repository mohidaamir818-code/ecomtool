import { NextRequest, NextResponse } from "next/server";
import { getBulkListingJobDraft } from "@/lib/bulk-listing/service";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();
    const jobId = request.nextUrl.searchParams.get("jobId")?.trim();

    if (!userId || !jobId) {
      return NextResponse.json({ error: "userId and jobId are required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const draft = await getBulkListingJobDraft(userId, jobId);
    if (!draft) {
      return NextResponse.json({ error: "Prepared draft not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, draft });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;
    const message = error instanceof Error ? error.message : "Failed to load draft.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
