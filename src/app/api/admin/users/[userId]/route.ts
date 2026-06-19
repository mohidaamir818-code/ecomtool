import { NextRequest, NextResponse } from "next/server";
import { getAdminUserDetail } from "@/lib/admin/users-service";
import { adminApiNotFound, requireAdminApi } from "@/lib/admin/require-admin-api";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const denied = requireAdminApi(request);
  if (denied) return denied;

  try {
    const { userId } = await context.params;
    const user = await getAdminUserDetail(userId);

    if (!user) {
      return adminApiNotFound();
    }

    return NextResponse.json({ success: true, user });
  } catch {
    return adminApiNotFound();
  }
}
