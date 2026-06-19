export type AdminUserStatus = "Active" | "Inactive";

export interface AdminUserListItem {
  id: string;
  fullName: string;
  email: string;
  joinDate: string;
  totalRequests: number;
  todayRequests: number;
  status: AdminUserStatus;
  lastActive: string | null;
  isBlocked: boolean;
}

export type AdminUsersSortField = "joinDate" | "totalRequests" | "todayRequests" | "name" | "lastActive";

export interface AdminUserDailyRequest {
  day: string;
  count: number;
}

export interface AdminUserRequestRow {
  id: string;
  endpoint: string;
  method: string;
  status: "success" | "failed";
  createdAt: string;
  isToday: boolean;
}

export interface AdminUserDetail {
  id: string;
  fullName: string;
  email: string;
  joinDate: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  totalRequests: number;
  todayRequests: number;
  status: AdminUserStatus;
  lastActive: string | null;
  dailyRequests: AdminUserDailyRequest[];
  recentRequests: AdminUserRequestRow[];
  isBlocked: boolean;
  blockedReason: string | null;
  blockedAt: string | null;
}

export interface PaginatedUserRequests {
  requests: AdminUserRequestRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
