import { NextRequest, NextResponse } from "next/server";
import { getAmazefConnectionStatus } from "@/lib/amazef/connection";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();

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

    const status = await getAmazefConnectionStatus(userId);
    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Amazef status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
