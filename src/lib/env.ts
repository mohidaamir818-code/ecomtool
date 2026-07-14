export function requireServerEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.startsWith("your-")) {
    throw new Error(`Missing or placeholder environment variable: ${key}`);
  }
  return value;
}

function cleanOptionalEnv(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.toLowerCase() === "pending") return "";
  if (trimmed.startsWith("your-")) return "";
  return trimmed;
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
  /** Separate Affiliate app (Supplier Finder) — not the Dropship app above. */
  aliexpressAffiliateAppKey: () => process.env.ALIEXPRESS_AFFILIATE_APP_KEY ?? "",
  aliexpressAffiliateAppSecret: () => process.env.ALIEXPRESS_AFFILIATE_APP_SECRET ?? "",
  aliexpressAccessToken: () => cleanOptionalEnv(process.env.ALIEXPRESS_ACCESS_TOKEN),
  aliexpressRefreshToken: () => cleanOptionalEnv(process.env.ALIEXPRESS_REFRESH_TOKEN),
  aliexpressApiKey: () => process.env.ALIEXPRESS_API_KEY ?? "",
  ebayAppId: () => process.env.EBAY_APP_ID ?? "",
  ebayCertId: () => process.env.EBAY_CERT_ID ?? "",
  ebayDevId: () => process.env.EBAY_DEV_ID ?? "",
  ebayRuName: () => process.env.EBAY_RUNAME?.trim() ?? "",
  ebayOAuthRedirectUrl: (origin: string) =>
    process.env.EBAY_OAUTH_REDIRECT_URL?.trim() ||
    `${origin.replace(/\/$/, "")}/api/ebay/callback`,
  anthropicApiKey: () => process.env.ANTHROPIC_API_KEY ?? "",
  nvidiaApiKey: () => process.env.NVIDIA_API_KEY?.trim() ?? "",
  smtpHost: () => process.env.SMTP_HOST ?? "smtp.gmail.com",
  smtpPort: () => Number(process.env.SMTP_PORT ?? 587),
  smtpUser: () => requireServerEnv("SMTP_USER"),
  smtpPass: () => requireServerEnv("SMTP_PASS"),
  smtpFrom: () => process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "",
  amazefApiUrl: () => process.env.AMAZEF_API_URL ?? "",
  amazefApiKey: () => process.env.AMAZEF_API_KEY ?? "",
  amazefListingUrl: () =>
    (process.env.AMAZEF_LISTING_API_URL ?? process.env.AMAZEF_API_URL ?? "")
      .trim()
      .replace(/\/$/, ""),
  amazefListingSecret: () => process.env.AMAZEF_LISTING_SECRET?.trim() ?? "",
  appUrl: () => process.env.APP_URL?.trim().replace(/\/$/, "") ?? "",
} as const;

export function getAppOrigin(): string {
  const url = serverEnv.appUrl();
  if (!url) {
    throw new Error("APP_URL is not configured. Set APP_URL in your environment to publish listings with description images.");
  }
  return url;
}
