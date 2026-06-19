import { NextRequest, NextResponse } from "next/server";
import { checkCompetitorWatchUpdate, getCompetitorWatches } from "@/lib/competitors/service";
import { logUserApiRequest } from "@/lib/requests/tracker";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { userId?: string; watchId?: string };

    if (!body.userId?.trim() || !body.watchId?.trim()) {
      return NextResponse.json({ error: "userId and watchId are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", body.userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

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
    const message = error instanceof Error ? error.message : "Failed to check competitor watch.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
