import "server-only";

import {
  resolveMarketplaceConfig,
  type EbayMarketplaceId,
} from "@/lib/ebay/marketplace";
import type { CreatePolicyType, EbayBusinessPolicies, EbayPoliciesResponse, EbayPolicyOption } from "@/types/listing-generator";

const EBAY_API_BASE = "https://api.ebay.com";
const POLICY_CACHE_TTL_MS = 5 * 60 * 1000;

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

function parsePolicyError(response: Response, data: { errors?: Array<{ message?: string }> }): string {
  return data.errors?.[0]?.message ?? `eBay policy request failed (${response.status}).`;
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

  if (!response.ok) {
    const data = (await response.json()) as { errors?: Array<{ message?: string }> };
    throw new Error(parsePolicyError(response, data));
  }

  const data = (await response.json()) as Record<
    string,
    Array<{ policyId?: string; name?: string }> | undefined
  >;
  const key = policyResponseKey(type);

  return (data[key] ?? [])
    .filter((policy) => policy.policyId && policy.name)
    .map((policy) => ({
      policyId: policy.policyId!,
      name: policy.name!,
    }));
}

async function createDefaultFulfillmentPolicy(
  token: string,
  marketplaceId: EbayMarketplaceId,
): Promise<EbayPolicyOption> {
  const config = resolveMarketplaceConfig(marketplaceId);
  const body = {
    name: "EcomTool Standard Shipping",
    marketplaceId: config.marketplaceId,
    categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }],
    handlingTime: { value: 1, unit: "DAY" },
    shippingOptions: [
      {
        optionType: "DOMESTIC",
        costType: "FLAT_RATE",
        shippingServices: [
          {
            sortOrder: 1,
            shippingServiceCode: config.defaultShippingServiceCode,
            shippingCost: {
              value: config.defaultShippingCost,
              currency: config.currency,
            },
            freeShipping: false,
            buyerResponsibleForShipping: false,
          },
        ],
      },
    ],
  };

  const response = await fetch(`${EBAY_API_BASE}/sell/account/v1/fulfillment_policy/`, {
    method: "POST",
    headers: accountHeaders(token, config.contentLanguage),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await response.json()) as {
    fulfillmentPolicyId?: string;
    name?: string;
    errors?: Array<{ message?: string }>;
  };

  if (!response.ok) {
    throw new Error(parsePolicyError(response, data));
  }

  if (!data.fulfillmentPolicyId) {
    throw new Error("Failed to create default shipping policy.");
  }

  return {
    policyId: data.fulfillmentPolicyId,
    name: data.name ?? "EcomTool Standard Shipping",
  };
}

async function createDefaultPaymentPolicy(
  token: string,
  marketplaceId: EbayMarketplaceId,
): Promise<EbayPolicyOption> {
  const config = resolveMarketplaceConfig(marketplaceId);
  const body = {
    name: "EcomTool Payment",
    marketplaceId: config.marketplaceId,
    categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }],
    immediatePay: true,
    paymentMethods: [{ paymentMethodType: "PAYPAL" }],
  };

  const response = await fetch(`${EBAY_API_BASE}/sell/account/v1/payment_policy/`, {
    method: "POST",
    headers: accountHeaders(token, config.contentLanguage),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await response.json()) as {
    paymentPolicyId?: string;
    name?: string;
    errors?: Array<{ message?: string }>;
  };

  if (!response.ok) {
    throw new Error(parsePolicyError(response, data));
  }

  if (!data.paymentPolicyId) {
    throw new Error("Failed to create default payment policy.");
  }

  return {
    policyId: data.paymentPolicyId,
    name: data.name ?? "EcomTool Payment",
  };
}

async function createDefaultReturnPolicy(
  token: string,
  marketplaceId: EbayMarketplaceId,
): Promise<EbayPolicyOption> {
  const config = resolveMarketplaceConfig(marketplaceId);
  const body = {
    name: "EcomTool 30 Day Returns",
    marketplaceId: config.marketplaceId,
    categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }],
    returnsAccepted: true,
    returnPeriod: { value: 30, unit: "DAY" },
    returnShippingCostPayer: "BUYER",
    refundMethod: "MONEY_BACK",
  };

  const response = await fetch(`${EBAY_API_BASE}/sell/account/v1/return_policy/`, {
    method: "POST",
    headers: accountHeaders(token, config.contentLanguage),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await response.json()) as {
    returnPolicyId?: string;
    name?: string;
    errors?: Array<{ message?: string }>;
  };

  if (!response.ok) {
    throw new Error(parsePolicyError(response, data));
  }

  if (!data.returnPolicyId) {
    throw new Error("Failed to create default return policy.");
  }

  return {
    policyId: data.returnPolicyId,
    name: data.name ?? "EcomTool 30 Day Returns",
  };
}

function buildSelected(
  fulfillment: EbayPolicyOption[],
  payment: EbayPolicyOption[],
  returns: EbayPolicyOption[],
): EbayBusinessPolicies {
  const fulfillmentPolicyId = fulfillment[0]?.policyId ?? "";
  const paymentPolicyId = payment[0]?.policyId ?? "";
  const returnPolicyId = returns[0]?.policyId ?? "";

  if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
    throw new Error("Could not resolve eBay business policies for this account.");
  }

  return { fulfillmentPolicyId, paymentPolicyId, returnPolicyId };
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

export async function createDefaultPolicy(
  token: string,
  marketplaceId: EbayMarketplaceId,
  policyType: CreatePolicyType,
): Promise<EbayPolicyOption> {
  if (policyType === "fulfillment") {
    return createDefaultFulfillmentPolicy(token, marketplaceId);
  }
  if (policyType === "payment") {
    return createDefaultPaymentPolicy(token, marketplaceId);
  }
  return createDefaultReturnPolicy(token, marketplaceId);
}

export interface EnsureSellerPoliciesOptions {
  userId: string;
  refresh?: boolean;
}

export async function ensureSellerPolicies(
  token: string,
  marketplaceId: EbayMarketplaceId,
  options: EnsureSellerPoliciesOptions,
): Promise<EbayPoliciesResponse> {
  const key = cacheKey(options.userId, marketplaceId);
  if (!options.refresh) {
    const cached = policyCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  let { fulfillment, payment, returns } = await loadAllPolicies(token, marketplaceId);

  if (fulfillment.length === 0) {
    await createDefaultFulfillmentPolicy(token, marketplaceId);
    fulfillment = await listPolicies(token, "fulfillment_policy", marketplaceId);
  }

  if (payment.length === 0) {
    await createDefaultPaymentPolicy(token, marketplaceId);
    payment = await listPolicies(token, "payment_policy", marketplaceId);
  }

  if (returns.length === 0) {
    await createDefaultReturnPolicy(token, marketplaceId);
    returns = await listPolicies(token, "return_policy", marketplaceId);
  }

  const response: EbayPoliciesResponse = {
    fulfillment,
    payment,
    return: returns,
    selected: buildSelected(fulfillment, payment, returns),
  };

  policyCache.set(key, {
    data: response,
    expiresAt: Date.now() + POLICY_CACHE_TTL_MS,
  });

  return response;
}

export async function createSellerPolicyAndRefresh(
  token: string,
  marketplaceId: EbayMarketplaceId,
  userId: string,
  policyType: CreatePolicyType,
): Promise<EbayPoliciesResponse> {
  await createDefaultPolicy(token, marketplaceId, policyType);
  invalidatePolicyCache(userId, marketplaceId);
  return ensureSellerPolicies(token, marketplaceId, { userId, refresh: true });
}
