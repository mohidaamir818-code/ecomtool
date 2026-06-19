import { UsersTable } from "@/features/admin/components/UsersTable";
import { getAdminPath, INTERNAL_ADMIN_PATH } from "@/lib/admin/config";

export default function AdminUsersPage() {
  const basePath = getAdminPath() || INTERNAL_ADMIN_PATH;

  return <UsersTable basePath={basePath} />;
}
