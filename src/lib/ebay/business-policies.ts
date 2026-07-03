import "server-only";

import { refreshUserAccessToken } from "@/lib/ebay/oauth-user";
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

interface RawPolicyRecord {
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
  name?: string;
  description?: string;
  handlingTime?: { value?: number; unit?: string };
  shippingOptions?: Array<{
    optionType?: string;
    shippingServices?: Array<{
      shippingCarrierCode?: string;
      shippingServiceCode?: string;
      freeShipping?: boolean;
      minEstimatedDeliveryTime?: { value?: number; unit?: string };
      maxEstimatedDeliveryTime?: { value?: number; unit?: string };
    }>;
  }>;
}

function buildFulfillmentPolicyDescription(raw: RawPolicyRecord): string | undefined {
  const parts: string[] = [];
  if (raw.description?.trim()) parts.push(raw.description.trim());

  const handling = raw.handlingTime;
  if (handling?.value != null && Number.isFinite(handling.value)) {
    const unit = (handling.unit ?? "DAY").toLowerCase();
    parts.push(`handling ${handling.value} ${unit}`);
  }

  for (const option of raw.shippingOptions ?? []) {
    for (const service of option.shippingServices ?? []) {
      const serviceParts: string[] = [];
      if (service.shippingCarrierCode) serviceParts.push(service.shippingCarrierCode);
      if (service.shippingServiceCode) {
        serviceParts.push(service.shippingServiceCode.replace(/_/g, " "));
      }

      const minDel = service.minEstimatedDeliveryTime;
      const maxDel = service.maxEstimatedDeliveryTime;
      if (minDel?.value != null && maxDel?.value != null) {
        const unit = (maxDel.unit ?? "DAY").toLowerCase();
        serviceParts.push(`${minDel.value}-${maxDel.value} ${unit}`);
      } else if (maxDel?.value != null) {
        const unit = (maxDel.unit ?? "DAY").toLowerCase();
        serviceParts.push(`${maxDel.value} ${unit}`);
      }

      if (service.freeShipping) serviceParts.push("free shipping");
      if (serviceParts.length > 0) parts.push(serviceParts.join(" "));
    }
  }

  const combined = parts.join(" | ").trim();
  return combined.length > 0 ? combined : undefined;
}

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

function policyHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
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

function mapPolicyOption(type: PolicyType, raw: RawPolicyRecord): EbayPolicyOption | null {
  const policyId =
    type === "fulfillment_policy"
      ? raw.fulfillmentPolicyId
      : type === "payment_policy"
        ? raw.paymentPolicyId
        : raw.returnPolicyId;

  if (!policyId || !raw.name) return null;

  const description =
    type === "fulfillment_policy" ? buildFulfillmentPolicyDescription(raw) : raw.description?.trim();

  return {
    policyId,
    name: raw.name,
    ...(description ? { description } : {}),
  };
}

async function listPolicies(
  token: string,
  type: PolicyType,
  marketplaceId: EbayMarketplaceId,
  userId: string,
  isRetry = false,
): Promise<EbayPolicyOption[]> {
  const config = resolveMarketplaceConfig(marketplaceId);
  const url = `${EBAY_API_BASE}/sell/account/v1/${type}?marketplace_id=${config.marketplaceId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: policyHeaders(token),
    cache: "no-store",
  });

  const responseText = await response.text();
  console.log("[eBay Policies] eBay response status:", response.status);
  console.log(`[eBay Policies] ${type} response body:`, responseText);

  if (response.status === 401 && !isRetry) {
    console.info("[eBay Policies] Token expired (401), refreshing and retrying", { userId, type });
    invalidatePolicyCache(userId, marketplaceId);
    const newToken = await refreshUserAccessToken(userId);
    if (newToken) {
      return listPolicies(newToken, type, marketplaceId, userId, true);
    }
    throw new Error("eBay account is not connected or token expired. Reconnect eBay.");
  }

  let data: Record<string, unknown> & {
    errors?: Array<{ message?: string; longMessage?: string }>;
  };

  try {
    data = JSON.parse(responseText) as typeof data;
  } catch {
    throw new Error(`eBay policy response was not valid JSON (${response.status}).`);
  }

  if (!response.ok) {
    console.error("[eBay Policies] Fetch failed", {
      type,
      marketplaceId: config.marketplaceId,
      status: response.status,
      response: data,
    });
    throw new Error(parsePolicyError(response, data));
  }

  const key = policyResponseKey(type);
  const rawPolicies = (data[key] as RawPolicyRecord[] | undefined) ?? [];
  const policies = rawPolicies
    .map((policy) => mapPolicyOption(type, policy))
    .filter((policy): policy is EbayPolicyOption => policy !== null);

  console.info("[eBay Policies] Fetch succeeded", {
    type,
    marketplaceId: config.marketplaceId,
    count: policies.length,
    total: data.total ?? rawPolicies.length,
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
    fulfillment.length === 0 && payment.length === 0 && returns.length === 0;

  return {
    selected: { fulfillmentPolicyId, paymentPolicyId, returnPolicyId },
    noPoliciesFound,
  };
}

async function loadAllPolicies(
  token: string,
  marketplaceId: EbayMarketplaceId,
  userId: string,
): Promise<{ fulfillment: EbayPolicyOption[]; payment: EbayPolicyOption[]; returns: EbayPolicyOption[] }> {
  const [fulfillment, payment, returns] = await Promise.all([
    listPolicies(token, "fulfillment_policy", marketplaceId, userId),
    listPolicies(token, "payment_policy", marketplaceId, userId),
    listPolicies(token, "return_policy", marketplaceId, userId),
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

  const { fulfillment, payment, returns } = await loadAllPolicies(
    token,
    marketplaceId,
    options.userId,
  );

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
