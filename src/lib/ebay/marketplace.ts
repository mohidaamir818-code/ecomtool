import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getEbayUserAccessToken } from "@/lib/ebay/oauth-user";

const EBAY_API_BASE = "https://api.ebay.com";

export const SUPPORTED_MARKETPLACES = ["EBAY_GB", "EBAY_US", "EBAY_DE"] as const;
export type EbayMarketplaceId = (typeof SUPPORTED_MARKETPLACES)[number];

export interface EbayMarketplaceConfig {
  marketplaceId: EbayMarketplaceId;
  currency: string;
  contentLanguage: string;
  acceptLanguage: string;
  endUserCountry: string;
  listingSiteHost: string;
  categoryTreeId: string;
  sellerHubUrl: string;
}

const MARKETPLACE_CONFIG: Record<EbayMarketplaceId, EbayMarketplaceConfig> = {
  EBAY_GB: {
    marketplaceId: "EBAY_GB",
    currency: "GBP",
    contentLanguage: "en-GB",
    acceptLanguage: "en-GB",
    endUserCountry: "GB",
    listingSiteHost: "www.ebay.co.uk",
    categoryTreeId: "3",
    sellerHubUrl: "https://www.ebay.co.uk/sh/landing",
  },
  EBAY_US: {
    marketplaceId: "EBAY_US",
    currency: "USD",
    contentLanguage: "en-US",
    acceptLanguage: "en-US",
    endUserCountry: "US",
    listingSiteHost: "www.ebay.com",
    categoryTreeId: "0",
    sellerHubUrl: "https://www.ebay.com/sh/landing",
  },
  EBAY_DE: {
    marketplaceId: "EBAY_DE",
    currency: "EUR",
    contentLanguage: "de-DE",
    acceptLanguage: "de-DE",
    endUserCountry: "DE",
    listingSiteHost: "www.ebay.de",
    categoryTreeId: "77",
    sellerHubUrl: "https://www.ebay.de/sh/landing",
  },
};

const DEFAULT_MARKETPLACE: EbayMarketplaceId = "EBAY_GB";

export function normalizeMarketplaceId(value: string | null | undefined): EbayMarketplaceId {
  if (value && SUPPORTED_MARKETPLACES.includes(value as EbayMarketplaceId)) {
    return value as EbayMarketplaceId;
  }
  return DEFAULT_MARKETPLACE;
}

export function resolveMarketplaceConfig(
  marketplaceId: string | null | undefined,
): EbayMarketplaceConfig {
  return MARKETPLACE_CONFIG[normalizeMarketplaceId(marketplaceId)];
}

export function buildEbayListingUrl(listingId: string, marketplaceId: string | null | undefined): string {
  const config = resolveMarketplaceConfig(marketplaceId);
  return `https://${config.listingSiteHost}/itm/${listingId}`;
}

export async function detectMarketplaceFromIdentity(accessToken: string): Promise<EbayMarketplaceId> {
  try {
    const response = await fetch(`${EBAY_API_BASE}/commerce/identity/v1/user/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) return DEFAULT_MARKETPLACE;

    const data = (await response.json()) as { registrationMarketplaceId?: string };
    return normalizeMarketplaceId(data.registrationMarketplaceId);
  } catch {
    return DEFAULT_MARKETPLACE;
  }
}

export async function persistSellerMarketplaceId(
  userId: string,
  marketplaceId: EbayMarketplaceId,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("ebay_oauth_tokens")
    .select("marketplace_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.marketplace_id) return;

  await supabase
    .from("ebay_oauth_tokens")
    .update({ marketplace_id: marketplaceId })
    .eq("user_id", userId);
}

export async function getSellerMarketplaceId(userId: string): Promise<EbayMarketplaceId> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("ebay_oauth_tokens")
    .select("marketplace_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.marketplace_id) {
    return normalizeMarketplaceId(data.marketplace_id);
  }

  const accessToken = await getEbayUserAccessToken(userId);
  if (!accessToken) return DEFAULT_MARKETPLACE;

  const detected = await detectMarketplaceFromIdentity(accessToken);
  await persistSellerMarketplaceId(userId, detected);
  return detected;
}
