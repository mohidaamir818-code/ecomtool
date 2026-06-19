import type { QuotaPlatform } from "@/types/quota";

export const DEFAULT_DAILY_LIMITS: Record<QuotaPlatform, number | null> = {
  ebay: 500,
  aliexpress: 500,
  amazef: null,
};

export const PLATFORM_LABELS: Record<QuotaPlatform, string> = {
  ebay: "eBay",
  aliexpress: "AliExpress",
  amazef: "Amazef",
};

export const QUOTA_EXCEEDED_MESSAGE =
  "You've reached today's limit. Your results will continue tomorrow — sit back and let us handle the rest! 🚀";

export const ALL_PLATFORMS: QuotaPlatform[] = ["amazef", "ebay", "aliexpress"];
