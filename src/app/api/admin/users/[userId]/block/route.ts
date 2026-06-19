import { NextRequest, NextResponse } from "next/server";
import { adminApiNotFound, requireAdminApi } from "@/lib/admin/require-admin-api";
import { blockUser } from "@/lib/user/block";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const denied = requireAdminApi(request);
  if (denied) return denied;

  try {
    const { userId } = await context.params;
    const body = (await request.json()) as { reason?: string; adminEmail?: string };
    const reason = body.reason?.trim() ?? "";

    if (reason.length < 3) {
      return adminApiNotFound();
    }

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (!profile) {
      return adminApiNotFound();
    }

    await blockUser(userId, reason, body.adminEmail?.trim() || "admin");

    return NextResponse.json({ success: true });
  } catch {
    return adminApiNotFound();
  }
}
