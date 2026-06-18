import { AdminDashboard } from "@/features/admin/components/AdminDashboard";
import { getAdminSession } from "@/lib/admin/session";
import { notFound } from "next/navigation";

export default async function InternalAdminPage() {
  const session = await getAdminSession();
  if (!session) {
    notFound();
  }

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-8">
      <AdminDashboard email={session.email} />
    </div>
  );
}
