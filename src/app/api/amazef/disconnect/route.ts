import { NextRequest, NextResponse } from "next/server";
import { disconnectAmazefAccount } from "@/lib/amazef/connection";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { userId?: string };
    const userId = body.userId?.trim();

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

    await disconnectAmazefAccount(userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to disconnect Amazef account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
