import { AdminAuthForm } from "@/features/admin/components/AdminAuthForm";
import { getAdminPath } from "@/lib/admin/config";
import { notFound } from "next/navigation";

export default function AdminAuthGatewayPage() {
  const adminPath = getAdminPath();
  if (!adminPath) {
    notFound();
  }

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-8">
      <AdminAuthForm adminPath={adminPath} />
    </div>
  );
}
