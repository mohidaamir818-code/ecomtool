import "server-only";

import type {
  AdminUserDailyRequest,
  AdminUserDetail,
  AdminUserListItem,
  AdminUserRequestRow,
  AdminUserStatus,
  AdminUsersSortField,
  PaginatedUserRequests,
} from "@/types/admin-users";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const ACTIVE_WINDOW_DAYS = 30;

interface RequestStatsRow {
  user_id: string;
  total_requests: number;
  today_requests: number;
  last_active: string | null;
}

function getDayStartUtc(): Date {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function isTodayUtc(isoDate: string): boolean {
  return new Date(isoDate).getTime() >= getDayStartUtc().getTime();
}

function deriveStatus(lastActive: string | null): AdminUserStatus {
  if (!lastActive) return "Inactive";

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ACTIVE_WINDOW_DAYS);

  return new Date(lastActive) >= cutoff ? "Active" : "Inactive";
}

function mapRequestRow(row: {
  id: string;
  endpoint: string;
  method: string;
  status: string;
  created_at: string;
}): AdminUserRequestRow {
  const createdAt = String(row.created_at);
  return {
    id: String(row.id),
    endpoint: String(row.endpoint),
    method: String(row.method),
    status: row.status === "failed" ? "failed" : "success",
    createdAt,
    isToday: isTodayUtc(createdAt),
  };
}

async function fetchRequestStatsMap(): Promise<Map<string, RequestStatsRow>> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("admin_user_request_stats");

  if (error) {
    if (error.message.includes("does not exist")) {
      return new Map();
    }
    throw new Error(error.message);
  }

  const map = new Map<string, RequestStatsRow>();
  for (const row of data ?? []) {
    map.set(String(row.user_id), {
      user_id: String(row.user_id),
      total_requests: Number(row.total_requests ?? 0),
      today_requests: Number(row.today_requests ?? 0),
      last_active: row.last_active ? String(row.last_active) : null,
    });
  }

  return map;
}

function sortUsers(
  users: AdminUserListItem[],
  sort: AdminUsersSortField,
  order: "asc" | "desc",
): AdminUserListItem[] {
  const direction = order === "asc" ? 1 : -1;

  return [...users].sort((a, b) => {
    switch (sort) {
      case "name":
        return a.fullName.localeCompare(b.fullName) * direction;
      case "totalRequests":
        return (a.totalRequests - b.totalRequests) * direction;
      case "todayRequests":
        return (a.todayRequests - b.todayRequests) * direction;
      case "lastActive": {
        const aTime = a.lastActive ? new Date(a.lastActive).getTime() : 0;
        const bTime = b.lastActive ? new Date(b.lastActive).getTime() : 0;
        return (aTime - bTime) * direction;
      }
      case "joinDate":
      default:
        return (new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime()) * direction;
    }
  });
}

export async function listAdminUsers(input?: {
  search?: string;
  sort?: AdminUsersSortField;
  order?: "asc" | "desc";
}): Promise<AdminUserListItem[]> {
  const supabase = getSupabaseAdmin();
  const search = input?.search?.trim().toLowerCase() ?? "";
  const sort = input?.sort ?? "joinDate";
  const order = input?.order ?? "desc";

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const statsMap = await fetchRequestStatsMap();

  const users: AdminUserListItem[] = (profiles ?? []).map((profile) => {
    const stats = statsMap.get(String(profile.id));
    const lastActive = stats?.last_active ?? null;

    return {
      id: String(profile.id),
      fullName: String(profile.full_name),
      email: String(profile.email),
      joinDate: String(profile.created_at),
      totalRequests: stats?.total_requests ?? 0,
      todayRequests: stats?.today_requests ?? 0,
      status: deriveStatus(lastActive),
      lastActive,
    };
  });

  const filtered = search
    ? users.filter(
        (user) =>
          user.fullName.toLowerCase().includes(search) ||
          user.email.toLowerCase().includes(search),
      )
    : users;

  return sortUsers(filtered, sort, order);
}

async function fetchDailyRequests(userId: string): Promise<AdminUserDailyRequest[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("admin_user_daily_requests", {
    p_user_id: userId,
    p_days: 30,
  });

  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((row: { day: string; request_count: number }) => ({
    day: String(row.day),
    count: Number(row.request_count ?? 0),
  }));
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const supabase = getSupabaseAdmin();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at, email_verified, onboarding_completed")
    .eq("id", userId)
    .single();

  if (error || !profile) return null;

  const statsMap = await fetchRequestStatsMap();
  const stats = statsMap.get(userId);
  const lastActive = stats?.last_active ?? null;

  const { data: recentRows } = await supabase
    .from("user_api_requests")
    .select("id, endpoint, method, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const dailyRequests = await fetchDailyRequests(userId);

  return {
    id: String(profile.id),
    fullName: String(profile.full_name),
    email: String(profile.email),
    joinDate: String(profile.created_at),
    emailVerified: Boolean(profile.email_verified),
    onboardingCompleted: Boolean(profile.onboarding_completed),
    totalRequests: stats?.total_requests ?? 0,
    todayRequests: stats?.today_requests ?? 0,
    status: deriveStatus(lastActive),
    lastActive,
    dailyRequests,
    recentRequests: (recentRows ?? []).map(mapRequestRow),
  };
}

export async function getAdminUserRequests(
  userId: string,
  page = 1,
  pageSize = 25,
): Promise<PaginatedUserRequests> {
  const supabase = getSupabaseAdmin();
  const safePage = Math.max(page, 1);
  const safeSize = Math.min(Math.max(pageSize, 1), 100);
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;

  const { count, error: countError } = await supabase
    .from("user_api_requests")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError && !countError.message.includes("does not exist")) {
    throw new Error(countError.message);
  }

  const total = count ?? 0;

  const { data, error } = await supabase
    .from("user_api_requests")
    .select("id, endpoint, method, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error && !error.message.includes("does not exist")) {
    throw new Error(error.message);
  }

  const requests = (data ?? []).map(mapRequestRow);

  return {
    requests,
    total,
    page: safePage,
    pageSize: safeSize,
    totalPages: Math.max(Math.ceil(total / safeSize), 1),
  };
}
