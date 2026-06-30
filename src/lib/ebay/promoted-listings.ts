import "server-only";

import { getEbayUserAccessToken } from "@/lib/ebay/oauth-user";
import { getSellerMarketplaceId, type EbayMarketplaceId } from "@/lib/ebay/marketplace";

const EBAY_API_BASE = "https://api.ebay.com";
const CAMPAIGN_NAME = "EcomTool Auto Promotion";

/**
 * Per-process cache of each seller's auto-promotion campaign id so we don't look
 * it up on every listing. Cleared on cold start — re-resolved lazily.
 */
const campaignCache = new Map<string, string>();

function marketingHeaders(token: string, marketplaceId: EbayMarketplaceId): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
  };
}

function clampBid(bidPercent: number): string {
  // eBay Promoted Listings Standard accepts bids roughly 2%–100%.
  const safe = Math.min(Math.max(Number(bidPercent) || 0, 2), 100);
  return safe.toFixed(1);
}

async function findExistingCampaign(
  token: string,
  marketplaceId: EbayMarketplaceId,
): Promise<string | null> {
  try {
    const url = new URL(`${EBAY_API_BASE}/sell/marketing/v1/ad_campaign`);
    url.searchParams.set("campaign_name", CAMPAIGN_NAME);

    const response = await fetch(url.toString(), {
      headers: marketingHeaders(token, marketplaceId),
      next: { revalidate: 0 },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      campaigns?: Array<{ campaignId?: string; campaignName?: string; campaignStatus?: string }>;
    };

    const match = data.campaigns?.find(
      (campaign) => campaign.campaignName === CAMPAIGN_NAME && campaign.campaignId,
    );
    return match?.campaignId ?? null;
  } catch {
    return null;
  }
}

async function createCampaign(
  token: string,
  marketplaceId: EbayMarketplaceId,
): Promise<string | null> {
  try {
    const startDate = new Date().toISOString();
    const response = await fetch(`${EBAY_API_BASE}/sell/marketing/v1/ad_campaign`, {
      method: "POST",
      headers: marketingHeaders(token, marketplaceId),
      body: JSON.stringify({
        campaignName: CAMPAIGN_NAME,
        marketplaceId,
        fundingStrategy: { fundingModel: "COST_PER_SALE" },
        startDate,
      }),
    });

    // 201 returns the new campaign URL in the Location header.
    if (response.status === 201) {
      const location = response.headers.get("location") ?? "";
      const id = location.split("/").filter(Boolean).pop();
      if (id) return id;
      return findExistingCampaign(token, marketplaceId);
    }

    // A campaign with this name may already exist (409) — reuse it.
    if (response.status === 409) {
      return findExistingCampaign(token, marketplaceId);
    }

    return null;
  } catch {
    return null;
  }
}

async function getOrCreateCampaign(
  userId: string,
  token: string,
  marketplaceId: EbayMarketplaceId,
): Promise<string | null> {
  const cached = campaignCache.get(userId);
  if (cached) return cached;

  const existing = await findExistingCampaign(token, marketplaceId);
  const campaignId = existing ?? (await createCampaign(token, marketplaceId));

  if (campaignId) campaignCache.set(userId, campaignId);
  return campaignId;
}

/**
 * Adds a single listing to the seller's auto-promotion campaign at the given ad
 * rate. Best-effort: never throws, returns whether the ad was created so the
 * caller can log/report without failing the listing itself.
 */
export async function promoteListing(
  userId: string,
  listingId: string,
  bidPercent: number,
): Promise<{ promoted: boolean; reason?: string }> {
  if (!listingId) return { promoted: false, reason: "Missing listing id." };

  try {
    const token = await getEbayUserAccessToken(userId);
    if (!token) return { promoted: false, reason: "eBay not connected." };

    const marketplaceId = await getSellerMarketplaceId(userId);
    const campaignId = await getOrCreateCampaign(userId, token, marketplaceId);
    if (!campaignId) {
      return { promoted: false, reason: "Could not create promotion campaign." };
    }

    const response = await fetch(
      `${EBAY_API_BASE}/sell/marketing/v1/ad_campaign/${encodeURIComponent(campaignId)}/ad`,
      {
        method: "POST",
        headers: marketingHeaders(token, marketplaceId),
        body: JSON.stringify({
          listingId,
          bidPercentage: clampBid(bidPercent),
        }),
      },
    );

    if (response.status === 201 || response.ok) {
      return { promoted: true };
    }

    // Already promoted (ad exists) counts as success.
    if (response.status === 409) {
      return { promoted: true };
    }

    let reason = `eBay marketing API returned ${response.status}.`;
    try {
      const body = (await response.json()) as { errors?: Array<{ message?: string }> };
      if (body.errors?.[0]?.message) reason = body.errors[0].message;
    } catch {
      // keep generic reason
    }
    return { promoted: false, reason };
  } catch (error) {
    return {
      promoted: false,
      reason: error instanceof Error ? error.message : "Promotion failed.",
    };
  }
}
