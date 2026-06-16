export function requireServerEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.startsWith("your-")) {
    throw new Error(`Missing or placeholder environment variable: ${key}`);
  }
  return value;
}

export const serverEnv = {
  supabaseUrl: () =>
    requireServerEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/rest\/v1\/?$/, ""),
  supabaseServiceRoleKey: () => requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
  aliexpressAppKey: () =>
    process.env.ALIEXPRESS_APP_KEY ?? process.env.ALIEXPRESS_API_KEY ?? "",
  aliexpressAppSecret: () =>
    process.env.ALIEXPRESS_APP_SECRET ??
    process.env.ALIEXPRESS_APP__SECRET ??
    "",
  aliexpressApiKey: () => process.env.ALIEXPRESS_API_KEY ?? "",
  ebayAppId: () => process.env.EBAY_APP_ID ?? "",
  ebayCertId: () => process.env.EBAY_CERT_ID ?? "",
  smtpHost: () => process.env.SMTP_HOST ?? "smtp.gmail.com",
  smtpPort: () => Number(process.env.SMTP_PORT ?? 587),
  smtpUser: () => requireServerEnv("SMTP_USER"),
  smtpPass: () => requireServerEnv("SMTP_PASS"),
  smtpFrom: () => process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "",
  amazefApiUrl: () => process.env.AMAZEF_API_URL ?? "",
  amazefApiKey: () => process.env.AMAZEF_API_KEY ?? "",
} as const;
