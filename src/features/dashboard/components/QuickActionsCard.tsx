import Link from "next/link";
import { quickActions } from "../data/mock-data";
import { DashboardIcon } from "./DashboardIcon";

export function QuickActionsCard() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-[#111827]">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {quickActions.map((action) => (
          <Link
            key={action.title}
            href={action.href}
            className="flex flex-col items-center rounded-xl border border-gray-100 bg-gray-50/50 p-4 text-center transition-all hover:border-brand/20 hover:bg-brand-light/30"
          >
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light text-brand">
              <DashboardIcon name={action.icon as Parameters<typeof DashboardIcon>[0]["name"]} className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-[#111827]">{action.title}</p>
            <p className="mt-0.5 text-[11px] text-[#9CA3AF]">{action.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
