import { NextRequest, NextResponse } from "next/server";
import { getUserQueue } from "@/lib/quota/queue-service";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await context.params;

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const queue = await getUserQueue(userId);
    return NextResponse.json({ success: true, queue });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to load queue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
