import { NextRequest, NextResponse } from "next/server";
import { adminApiNotFound, requireAdminApi } from "@/lib/admin/require-admin-api";
import { unblockUser } from "@/lib/user/block";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const denied = requireAdminApi(request);
  if (denied) return denied;

  try {
    const { userId } = await context.params;

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (!profile) {
      return adminApiNotFound();
    }

    await unblockUser(userId);

    return NextResponse.json({ success: true });
  } catch {
    return adminApiNotFound();
  }
}
