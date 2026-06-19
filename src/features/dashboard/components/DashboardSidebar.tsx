"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/landing/Logo";
import { dashboardNavItems } from "../data/mock-data";
import { DashboardIcon } from "./DashboardIcon";
import { useUserBlock } from "@/features/dashboard/context/UserBlockContext";

interface DashboardSidebarProps {
  userName?: string;
  plan?: string;
}

function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isHelpItem(href: string) {
  return href === "/dashboard/help";
}

export function DashboardSidebar({ userName = "User", plan = "Free Plan" }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { isBlocked } = useUserBlock();
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="flex h-screen w-[240px] shrink-0 flex-col border-r border-gray-100 bg-white">
      <div className="border-b border-gray-100 px-5 py-5">
        {isBlocked ? (
          <Logo />
        ) : (
          <Link href="/dashboard">
            <Logo />
          </Link>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {dashboardNavItems.map((item) => {
            const active = isNavActive(pathname, item.href);
            const helpItem = isHelpItem(item.href);
            const disabled = isBlocked && !helpItem;

            if (disabled) {
              return (
                <li key={item.label}>
                  <span
                    className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-[#9CA3AF] opacity-50"
                    aria-disabled
                  >
                    <DashboardIcon name={item.icon as Parameters<typeof DashboardIcon>[0]["name"]} />
                    {item.label}
                  </span>
                </li>
              );
            }

            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-brand text-white shadow-sm"
                      : "text-[#6B7280] hover:bg-gray-50 hover:text-[#111827]"
                  }`}
                >
                  <DashboardIcon name={item.icon as Parameters<typeof DashboardIcon>[0]["name"]} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-3 border-t border-gray-100 p-4">
        <div className="rounded-xl bg-brand-light p-4">
          <div className="mb-2 flex items-center gap-2 text-brand">
            <DashboardIcon name="crown" className="h-4 w-4" />
            <span className="text-sm font-semibold">Upgrade to Pro</span>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-[#6B7280]">
            Unlock unlimited requests and advanced analytics.
          </p>
          <button
            type="button"
            disabled={isBlocked}
            className="w-full rounded-lg bg-brand py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Upgrade Now
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#111827]">{userName}</p>
            <p className="text-xs text-[#9CA3AF]">{plan}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
