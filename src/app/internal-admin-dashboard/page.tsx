import Link from "next/link";
import { AdminDashboard } from "@/features/admin/components/AdminDashboard";
import { getAdminPath, INTERNAL_ADMIN_PATH } from "@/lib/admin/config";

export default function InternalAdminPage() {
  const basePath = getAdminPath() || INTERNAL_ADMIN_PATH;

  return (
    <div className="space-y-6">
      <AdminDashboard />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={`${basePath}/users`}
          className="rounded-2xl border border-white/10 bg-black/20 p-6 transition hover:border-[#5842f4]/50 hover:bg-[#5842f4]/10"
        >
          <h2 className="text-base font-bold text-white">User Management</h2>
          <p className="mt-2 text-sm text-white/60">
            View all users, request counts, activity status, and per-user analytics.
          </p>
        </Link>
      </div>
    </div>
  );
}
