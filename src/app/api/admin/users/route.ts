import { NextRequest, NextResponse } from "next/server";
import { listAdminUsers } from "@/lib/admin/users-service";
import { adminApiNotFound, requireAdminApi } from "@/lib/admin/require-admin-api";
import type { AdminUsersSortField } from "@/types/admin-users";

const SORT_FIELDS: AdminUsersSortField[] = [
  "joinDate",
  "totalRequests",
  "todayRequests",
  "name",
  "lastActive",
];

export async function GET(request: NextRequest) {
  const denied = requireAdminApi(request);
  if (denied) return denied;

  try {
    const params = request.nextUrl.searchParams;
    const search = params.get("search") ?? undefined;
    const sortParam = params.get("sort") as AdminUsersSortField | null;
    const orderParam = params.get("order");
    const sort = sortParam && SORT_FIELDS.includes(sortParam) ? sortParam : "joinDate";
    const order = orderParam === "asc" ? "asc" : "desc";

    const users = await listAdminUsers({ search, sort, order });

    return NextResponse.json({ success: true, users });
  } catch {
    return adminApiNotFound();
  }
}
