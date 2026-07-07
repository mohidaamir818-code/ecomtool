import { NextRequest, NextResponse } from "next/server";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      guideId?: string;
      stepIndex?: number;
      completed?: boolean;
    };

    const userId = body.userId?.trim();
    const guideId = body.guideId?.trim();
    const stepIndex = Number(body.stepIndex ?? 0);
    const completed = Boolean(body.completed);

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }
    if (!guideId) {
      return NextResponse.json({ error: "guideId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    // v1: acknowledge progress; persist server-side in a future migration.
    return NextResponse.json({
      success: true,
      progress: { userId, guideId, stepIndex, completed },
    });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to save guide progress.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
