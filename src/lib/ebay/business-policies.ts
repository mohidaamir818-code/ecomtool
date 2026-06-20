import "server-only";

import {
  resolveMarketplaceConfig,
  type EbayMarketplaceId,
} from "@/lib/ebay/marketplace";
import type { EbayBusinessPolicies, EbayPoliciesResponse, EbayPolicyOption } from "@/types/listing-generator";

const EBAY_API_BASE = "https://api.ebay.com";
const POLICY_CACHE_TTL_MS = 5 * 60 * 1000;

const EMPTY_POLICY_MESSAGE =
  "No policies found on your eBay account. Please create shipping, return and payment policies on eBay Seller Hub first, then come back here.";

type PolicyType = "fulfillment_policy" | "payment_policy" | "return_policy";

interface PolicyCacheEntry {
  data: EbayPoliciesResponse;
  expiresAt: number;
}

const policyCache = new Map<string, PolicyCacheEntry>();

function cacheKey(userId: string, marketplaceId: string): string {
  return `${userId}:${marketplaceId}`;
}

export function invalidatePolicyCache(userId: string, marketplaceId: string): void {
  policyCache.delete(cacheKey(userId, marketplaceId));
}

function accountHeaders(token: string, contentLanguage: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Content-Language": contentLanguage,
  };
}

function policyResponseKey(type: PolicyType): string {
  if (type === "fulfillment_policy") return "fulfillmentPolicies";
  if (type === "payment_policy") return "paymentPolicies";
  return "returnPolicies";
}

function parsePolicyError(
  response: Response,
  data: { errors?: Array<{ message?: string; longMessage?: string }> },
): string {
  const messages = (data.errors ?? [])
    .map((entry) => entry.longMessage ?? entry.message)
    .filter((message): message is string => Boolean(message));

  if (messages.length > 0) {
    return messages.join("; ");
  }

  return `eBay policy request failed (${response.status}).`;
}

async function listPolicies(
  token: string,
  type: PolicyType,
  marketplaceId: EbayMarketplaceId,
): Promise<EbayPolicyOption[]> {
  const config = resolveMarketplaceConfig(marketplaceId);
  const url = new URL(`${EBAY_API_BASE}/sell/account/v1/${type}`);
  url.searchParams.set("marketplace_id", config.marketplaceId);

  const response = await fetch(url.toString(), {
    headers: accountHeaders(token, config.contentLanguage),
    cache: "no-store",
  });

  const data = (await response.json()) as Record<
    string,
    Array<{ policyId?: string; name?: string }> | undefined
  > & { errors?: Array<{ message?: string; longMessage?: string }> };

  if (!response.ok) {
    console.error("[eBay Policies] Fetch failed", {
      type,
      marketplaceId: config.marketplaceId,
      status: response.status,
      response: data,
    });
    throw new Error(parsePolicyError(response, data));
  }

  console.log(`[eBay Policies] ${type} response:`, JSON.stringify(data));

  const key = policyResponseKey(type);
  const policies = (data[key] ?? [])
    .filter((policy) => policy.policyId && policy.name)
    .map((policy) => ({
      policyId: policy.policyId!,
      name: policy.name!,
    }));

  console.info("[eBay Policies] Fetch succeeded", {
    type,
    marketplaceId: config.marketplaceId,
    count: policies.length,
  });

  return policies;
}

function buildSelected(
  fulfillment: EbayPolicyOption[],
  payment: EbayPolicyOption[],
  returns: EbayPolicyOption[],
): { selected: EbayBusinessPolicies; noPoliciesFound: boolean } {
  const fulfillmentPolicyId = fulfillment[0]?.policyId ?? "";
  const paymentPolicyId = payment[0]?.policyId ?? "";
  const returnPolicyId = returns[0]?.policyId ?? "";

  const noPoliciesFound =
    fulfillment.length === 0 || payment.length === 0 || returns.length === 0;

  return {
    selected: { fulfillmentPolicyId, paymentPolicyId, returnPolicyId },
    noPoliciesFound,
  };
}

async function loadAllPolicies(
  token: string,
  marketplaceId: EbayMarketplaceId,
): Promise<{ fulfillment: EbayPolicyOption[]; payment: EbayPolicyOption[]; returns: EbayPolicyOption[] }> {
  const [fulfillment, payment, returns] = await Promise.all([
    listPolicies(token, "fulfillment_policy", marketplaceId),
    listPolicies(token, "payment_policy", marketplaceId),
    listPolicies(token, "return_policy", marketplaceId),
  ]);

  return { fulfillment, payment, returns };
}

export interface FetchSellerPoliciesOptions {
  userId: string;
  refresh?: boolean;
}

export async function fetchSellerPolicies(
  token: string,
  marketplaceId: EbayMarketplaceId,
  options: FetchSellerPoliciesOptions,
): Promise<EbayPoliciesResponse> {
  const key = cacheKey(options.userId, marketplaceId);
  if (!options.refresh) {
    const cached = policyCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  const { fulfillment, payment, returns } = await loadAllPolicies(token, marketplaceId);

  console.info("[eBay Policies] Loaded seller policies", {
    userId: options.userId,
    marketplaceId,
    fulfillment: fulfillment.length,
    payment: payment.length,
    returns: returns.length,
  });

  const { selected, noPoliciesFound } = buildSelected(fulfillment, payment, returns);

  const response: EbayPoliciesResponse = {
    fulfillment,
    payment,
    return: returns,
    selected,
    ...(noPoliciesFound
      ? {
          noPoliciesFound: true,
          emptyPolicyMessage: EMPTY_POLICY_MESSAGE,
        }
      : {}),
  };

  policyCache.set(key, {
    data: response,
    expiresAt: Date.now() + POLICY_CACHE_TTL_MS,
  });

  return response;
}
