import { NextRequest, NextResponse } from "next/server";
import { getUserQuotas } from "@/lib/quota/service";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await context.params;

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const data = await getUserQuotas(userId);
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to load quotas.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
