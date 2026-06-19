import { NextRequest, NextResponse } from "next/server";
import { getUserQuotas } from "@/lib/quota/service";
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

    const data = await getUserQuotas(userId);
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load quotas.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
