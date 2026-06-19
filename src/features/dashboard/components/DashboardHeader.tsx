"use client";

import Link from "next/link";
import { DashboardIcon } from "./DashboardIcon";
import { useUserBlock } from "@/features/dashboard/context/UserBlockContext";

interface DashboardHeaderProps {
  userName?: string;
  dateRangeLabel?: string;
}

export function DashboardHeader({
  userName = "User",
  dateRangeLabel,
}: DashboardHeaderProps) {
  const { isBlocked } = useUserBlock();
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 1)
    .toUpperCase();

  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">Dashboard</h1>
        <p className="mt-0.5 text-sm text-[#6B7280]">
          Overview of your account activity and usage.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/help"
          className="flex items-center gap-1.5 text-sm font-medium text-[#6B7280] hover:text-[#111827]"
        >
          <DashboardIcon name="help" className="h-4 w-4" />
          Help
        </Link>

        <button
          type="button"
          disabled={isBlocked}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-[#6B7280] hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <DashboardIcon name="bell" className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
          {initials}
        </div>

        <button
          type="button"
          disabled={isBlocked}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-[#374151] hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <DashboardIcon name="calendar" className="h-4 w-4 text-[#6B7280]" />
          {dateRangeLabel ?? "Last 7 days"}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M3.5 5.25L7 8.75l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  );
}
