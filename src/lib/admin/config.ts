export const AUTH_SESSION_COOKIE = "Auth-Session";

export const INTERNAL_ADMIN_PATH = "/internal-admin-dashboard";

export const ADMIN_AUTH_GATEWAY_PATH = "/admin-auth-gateway";

export function getAdminPath(): string {
  const raw = process.env.ADMIN_PATH?.trim() ?? "";
  if (!raw) return "";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function getAdminEmail(): string {
  return process.env.ADMIN_EMAIL?.trim() ?? "";
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}

export function getAdminSessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}

export function getAllowedIps(): string[] {
  const raw = process.env.ALLOWED_IP?.trim() ?? "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
}

export function isAdminConfigured(): boolean {
  return Boolean(
    getAdminPath() && getAdminEmail() && getAdminPassword() && getAllowedIps().length > 0,
  );
}
