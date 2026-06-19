"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AdminUserDetail, AdminUserRequestRow } from "@/types/admin-users";
import { UserDetailSkeleton } from "@/features/admin/components/AdminSkeletons";
import { RequestsChart } from "@/features/admin/components/RequestsChart";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface UserDetailViewProps {
  userId: string;
  basePath: string;
}

export function UserDetailView({ userId, basePath }: UserDetailViewProps) {
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [requests, setRequests] = useState<AdminUserRequestRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      if (!response.ok) {
        setUser(null);
        return;
      }
      const data = (await response.json()) as { user?: AdminUserDetail };
      setUser(data.user ?? null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/users/${userId}/requests?page=${page}&pageSize=25`,
      );
      if (!response.ok) {
        setRequests([]);
        return;
      }
      const data = (await response.json()) as {
        requests?: AdminUserRequestRow[];
        totalPages?: number;
      };
      setRequests(data.requests ?? []);
      setTotalPages(data.totalPages ?? 1);
    } finally {
      setRequestsLoading(false);
    }
  }, [page, userId]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  if (loading) {
    return <UserDetailSkeleton />;
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-10 text-center text-sm text-white/50">
        User not found.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href={`${basePath}/users`} className="text-sm text-white/50 hover:text-white">
          ← Back to users
        </Link>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/20 p-6 sm:flex-row sm:items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#5842f4]/20 text-xl font-bold text-[#a89bff]">
          {getInitials(user.fullName)}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{user.fullName}</h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                user.status === "Active"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-white/10 text-white/50"
              }`}
            >
              {user.status}
            </span>
            <span className="inline-flex rounded-full bg-[#5842f4]/20 px-2.5 py-1 text-xs font-semibold text-[#a89bff]">
              {user.totalRequests.toLocaleString()} total requests
            </span>
          </div>
          <p className="mt-1 text-sm text-white/60">{user.email}</p>
          <p className="mt-1 text-sm text-white/50">Joined {formatJoinDate(user.joinDate)}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs uppercase tracking-wide text-white/50">Today&apos;s Requests</p>
          <p className="mt-2 text-3xl font-bold text-white">{user.todayRequests}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs uppercase tracking-wide text-white/50">Total Requests</p>
          <p className="mt-2 text-3xl font-bold text-white">{user.totalRequests.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs uppercase tracking-wide text-white/50">Last Active</p>
          <p className="mt-2 text-lg font-semibold text-white">
            {user.lastActive ? formatDateTime(user.lastActive) : "Never"}
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Requests per day (last 30 days)</h2>
        <RequestsChart data={user.dailyRequests} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">Request history</h2>
          <p className="text-sm text-white/50">Today&apos;s requests are highlighted</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          {requestsLoading ? (
            <div className="p-6 text-sm text-white/50">Loading requests...</div>
          ) : requests.length === 0 ? (
            <div className="p-10 text-center text-sm text-white/50">No requests recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wide text-white/50">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date & Time</th>
                    <th className="px-4 py-3 font-semibold">Endpoint</th>
                    <th className="px-4 py-3 font-semibold">Method</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr
                      key={request.id}
                      className={`border-b border-white/5 ${
                        request.isToday ? "bg-[#5842f4]/10" : "hover:bg-white/5"
                      }`}
                    >
                      <td className="px-4 py-4 text-white/80">{formatDateTime(request.createdAt)}</td>
                      <td className="px-4 py-4 font-mono text-xs text-white/70">{request.endpoint}</td>
                      <td className="px-4 py-4 text-white/70">{request.method}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            request.status === "success"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-red-500/15 text-red-300"
                          }`}
                        >
                          {request.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              disabled={page <= 1 || requestsLoading}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50"
            >
              Previous
            </button>
            <p className="text-sm text-white/50">
              Page {page} of {totalPages}
            </p>
            <button
              type="button"
              disabled={page >= totalPages || requestsLoading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
