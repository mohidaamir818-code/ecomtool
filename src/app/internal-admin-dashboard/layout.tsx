import type { Metadata } from "next";
import { AdminShell } from "@/features/admin/components/AdminShell";
import { getAdminPath, INTERNAL_ADMIN_PATH } from "@/lib/admin/config";
import { getAdminSession } from "@/lib/admin/session";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Not Found",
  robots: { index: false, follow: false },
};

export default async function InternalAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) {
    notFound();
  }

  const basePath = getAdminPath() || INTERNAL_ADMIN_PATH;

  return (
    <AdminShell email={session.email} basePath={basePath}>
      {children}
    </AdminShell>
  );
}
