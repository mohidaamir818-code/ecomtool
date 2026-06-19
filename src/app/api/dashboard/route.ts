import { NextRequest, NextResponse } from "next/server";
import { getDashboardData } from "@/lib/dashboard/service";
import { logUserApiRequest } from "@/lib/requests/tracker";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const data = await getDashboardData(userId);

    void logUserApiRequest({
      userId,
      endpoint: "/api/dashboard",
      method: "GET",
      status: "success",
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
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
