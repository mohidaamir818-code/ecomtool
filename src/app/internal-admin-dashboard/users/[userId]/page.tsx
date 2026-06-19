import { UserDetailView } from "@/features/admin/components/UserDetailView";
import { getAdminPath, INTERNAL_ADMIN_PATH } from "@/lib/admin/config";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const basePath = getAdminPath() || INTERNAL_ADMIN_PATH;

  return <UserDetailView userId={userId} basePath={basePath} />;
}
