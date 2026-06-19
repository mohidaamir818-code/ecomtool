import { NextRequest, NextResponse } from "next/server";
import { getUserQueue } from "@/lib/quota/queue-service";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await context.params;

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const queue = await getUserQueue(userId);
    return NextResponse.json({ success: true, queue });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load queue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
