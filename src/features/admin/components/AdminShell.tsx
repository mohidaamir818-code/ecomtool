"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface AdminShellProps {
  email: string;
  basePath: string;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { label: "Overview", segment: "" },
  { label: "Users", segment: "/users" },
];

export function AdminShell({ email, basePath, children }: AdminShellProps) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      window.location.href = "/admin-auth-gateway";
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-white/10 bg-black/20 lg:w-64 lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col p-6">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                EcomTools Admin
              </p>
              <p className="mt-2 truncate text-sm text-white/70">{email}</p>
            </div>

            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const href = `${basePath}${item.segment}`;
                const active =
                  item.segment === ""
                    ? pathname === basePath
                    : pathname.startsWith(`${basePath}${item.segment}`);

                return (
                  <Link
                    key={item.label}
                    href={href}
                    className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-[#5842f4] text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="mt-auto rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
            >
              {loggingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </aside>

        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
