"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AdminUserListItem, AdminUsersSortField } from "@/types/admin-users";
import { TableSkeleton } from "@/features/admin/components/AdminSkeletons";

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
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
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface UsersTableProps {
  basePath: string;
}

export function UsersTable({ basePath }: UsersTableProps) {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<AdminUsersSortField>("joinDate");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort,
        order,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      if (!response.ok) {
        setUsers([]);
        return;
      }

      const data = (await response.json()) as { users?: AdminUserListItem[] };
      setUsers(data.users ?? []);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, order, sort]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function toggleSort(field: AdminUsersSortField) {
    if (sort === field) {
      setOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSort(field);
    setOrder("desc");
  }

  function sortLabel(field: AdminUsersSortField, label: string) {
    const active = sort === field;
    const arrow = active ? (order === "asc" ? " ↑" : " ↓") : "";
    return `${label}${arrow}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="mt-1 text-sm text-white/60">
            Manage registered users and monitor API request activity.
          </p>
        </div>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name or email..."
          className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40 sm:max-w-xs"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
        {loading ? (
          <div className="p-4">
            <TableSkeleton />
          </div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-sm text-white/50">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wide text-white/50">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">
                    <button type="button" onClick={() => toggleSort("joinDate")} className="hover:text-white">
                      {sortLabel("joinDate", "Join Date")}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleSort("totalRequests")}
                      className="hover:text-white"
                    >
                      {sortLabel("totalRequests", "Total Requests")}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleSort("todayRequests")}
                      className="hover:text-white"
                    >
                      {sortLabel("todayRequests", "Today")}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">
                    <button type="button" onClick={() => toggleSort("lastActive")} className="hover:text-white">
                      {sortLabel("lastActive", "Last Active")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-white/5 transition hover:bg-white/5"
                  >
                    <td className="px-4 py-4 font-medium text-white">
                      <Link href={`${basePath}/users/${user.id}`} className="block hover:text-[#a89bff]">
                        {user.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-white/70">{user.email}</td>
                    <td className="px-4 py-4 text-white/70">{formatJoinDate(user.joinDate)}</td>
                    <td className="px-4 py-4 text-white/70">{user.totalRequests.toLocaleString()}</td>
                    <td className="px-4 py-4 text-white/70">{user.todayRequests.toLocaleString()}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          user.status === "Active"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-white/10 text-white/50"
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-white/70">{formatDate(user.lastActive)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
