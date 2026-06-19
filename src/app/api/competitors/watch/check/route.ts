import { NextRequest, NextResponse } from "next/server";
import { checkCompetitorWatchUpdate, getCompetitorWatches } from "@/lib/competitors/service";
import { logUserApiRequest } from "@/lib/requests/tracker";
import { quotaErrorResponse } from "@/lib/quota/api-helpers";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { userId?: string; watchId?: string };

    if (!body.userId?.trim() || !body.watchId?.trim()) {
      return NextResponse.json({ error: "userId and watchId are required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(body.userId);
    if (accessDenied) return accessDenied;

    const result = await checkCompetitorWatchUpdate(body.userId, body.watchId);
    const watches = await getCompetitorWatches(body.userId);

    void logUserApiRequest({
      userId: body.userId,
      endpoint: "/api/competitors/watch/check",
      method: "POST",
      status: "success",
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      watch: result.watch,
      matches: result.matches,
      watches,
    });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const quotaResponse = quotaErrorResponse(error);
    if (quotaResponse) return quotaResponse;

    const message = error instanceof Error ? error.message : "Failed to check competitor watch.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
