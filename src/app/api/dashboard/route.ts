import { NextRequest, NextResponse } from "next/server";
import { getDashboardData } from "@/lib/dashboard/service";
import { logUserApiRequest } from "@/lib/requests/tracker";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const data = await getDashboardData(userId);

    void logUserApiRequest({
      userId,
      endpoint: "/api/dashboard",
      method: "GET",
      status: "success",
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to load dashboard data.";
    const userId = request.nextUrl.searchParams.get("userId");
    if (userId) {
      void logUserApiRequest({
        userId,
        endpoint: "/api/dashboard",
        method: "GET",
        status: "failed",
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
