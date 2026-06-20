import "server-only";

import type { EbayBusinessPolicies, EbayPoliciesResponse, EbayPolicyOption } from "@/types/listing-generator";

const EBAY_API_BASE = "https://api.ebay.com";
const MARKETPLACE_ID = "EBAY_GB";

type PolicyType = "fulfillment_policy" | "payment_policy" | "return_policy";

function accountHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Content-Language": "en-GB",
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

async function listPolicies(token: string, type: PolicyType): Promise<EbayPolicyOption[]> {
  const url = new URL(`${EBAY_API_BASE}/sell/account/v1/${type}`);
  url.searchParams.set("marketplace_id", MARKETPLACE_ID);

  const response = await fetch(url.toString(), {
    headers: accountHeaders(token),
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

async function createDefaultFulfillmentPolicy(token: string): Promise<EbayPolicyOption> {
  const body = {
    name: "EcomTool Default Shipping",
    marketplaceId: MARKETPLACE_ID,
    categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }],
    handlingTime: { value: 1, unit: "BUSINESS_DAY" },
    shippingOptions: [
      {
        optionType: "DOMESTIC",
        costType: "FLAT_RATE",
        shippingServices: [
          {
            shippingCarrierCode: "ROYAL_MAIL",
            shippingServiceCode: "UK_RoyalMailSecondClassStandard",
            freeShipping: false,
          },
        ],
      },
    ],
  };

  const response = await fetch(`${EBAY_API_BASE}/sell/account/v1/fulfillment_policy/`, {
    method: "POST",
    headers: accountHeaders(token),
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
    name: data.name ?? "EcomTool Default Shipping",
  };
}

async function createDefaultPaymentPolicy(token: string): Promise<EbayPolicyOption> {
  const body = {
    name: "EcomTool Default Payment",
    marketplaceId: MARKETPLACE_ID,
    categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }],
    immediatePay: true,
    paymentMethods: [{ paymentMethodType: "PAYPAL" }, { paymentMethodType: "CREDIT_CARD" }],
  };

  const response = await fetch(`${EBAY_API_BASE}/sell/account/v1/payment_policy/`, {
    method: "POST",
    headers: accountHeaders(token),
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
    name: data.name ?? "EcomTool Default Payment",
  };
}

async function createDefaultReturnPolicy(token: string): Promise<EbayPolicyOption> {
  const body = {
    name: "EcomTool Default Returns",
    marketplaceId: MARKETPLACE_ID,
    categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }],
    returnsAccepted: true,
    returnPeriod: { value: 30, unit: "DAY" },
    returnShippingCostPayer: "BUYER",
  };

  const response = await fetch(`${EBAY_API_BASE}/sell/account/v1/return_policy/`, {
    method: "POST",
    headers: accountHeaders(token),
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
    name: data.name ?? "EcomTool Default Returns",
  };
}

function buildSelected(fulfillment: EbayPolicyOption[], payment: EbayPolicyOption[], returns: EbayPolicyOption[]): EbayBusinessPolicies {
  const fulfillmentPolicyId = fulfillment[0]?.policyId ?? "";
  const paymentPolicyId = payment[0]?.policyId ?? "";
  const returnPolicyId = returns[0]?.policyId ?? "";

  if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
    throw new Error("Could not resolve eBay business policies for this account.");
  }

  return { fulfillmentPolicyId, paymentPolicyId, returnPolicyId };
}

export async function ensureSellerPolicies(token: string): Promise<EbayPoliciesResponse> {
  let fulfillment = await listPolicies(token, "fulfillment_policy");
  let payment = await listPolicies(token, "payment_policy");
  let returns = await listPolicies(token, "return_policy");

  if (fulfillment.length === 0) {
    await createDefaultFulfillmentPolicy(token);
    fulfillment = await listPolicies(token, "fulfillment_policy");
  }

  if (payment.length === 0) {
    await createDefaultPaymentPolicy(token);
    payment = await listPolicies(token, "payment_policy");
  }

  if (returns.length === 0) {
    await createDefaultReturnPolicy(token);
    returns = await listPolicies(token, "return_policy");
  }

  return {
    fulfillment,
    payment,
    return: returns,
    selected: buildSelected(fulfillment, payment, returns),
  };
}
