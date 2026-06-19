import { NextRequest, NextResponse } from "next/server";
import { getAdminUserRequests } from "@/lib/admin/users-service";
import { adminApiNotFound, requireAdminApi } from "@/lib/admin/require-admin-api";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const denied = requireAdminApi(request);
  if (denied) return denied;

  try {
    const { userId } = await context.params;
    const params = request.nextUrl.searchParams;
    const page = Number(params.get("page") ?? "1");
    const pageSize = Number(params.get("pageSize") ?? "25");

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (!profile) {
      return adminApiNotFound();
    }

    const data = await getAdminUserRequests(userId, page, pageSize);

    return NextResponse.json({ success: true, ...data });
  } catch {
    return adminApiNotFound();
  }
}
