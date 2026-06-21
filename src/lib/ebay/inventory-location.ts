import "server-only";

import {
  getSellerInventoryLocation,
  insertSellerInventoryLocation,
  updateSellerInventoryLocation,
} from "@/lib/ebay/seller-inventory-location-db";
import { getEbayUserAccessToken } from "@/lib/ebay/oauth-user";
import {
  getSellerMarketplaceId,
  resolveMarketplaceConfig,
  type EbayMarketplaceId,
} from "@/lib/ebay/marketplace";
import type { EbaySellerInventoryLocation } from "@/types/listing-generator";

const EBAY_API_BASE = "https://api.ebay.com";

export interface SellerAddressInput {
  city: string;
  postalCode: string;
  country: string;
}

function inventoryHeaders(token: string, marketplaceId: EbayMarketplaceId): HeadersInit {
  const { contentLanguage, acceptLanguage } = resolveMarketplaceConfig(marketplaceId);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Content-Language": contentLanguage,
    "Accept-Language": acceptLanguage,
  };
}

export function buildMerchantLocationKey(sellerId: string): string {
  const compact = sellerId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `ECT-${compact}-WH`;
}

export function normalizeCountryCode(country: string): string {
  return country.trim().toUpperCase();
}

export function validateSellerAddress(input: SellerAddressInput): string | null {
  const city = input.city.trim();
  const postalCode = input.postalCode.trim();
  const country = normalizeCountryCode(input.country);

  if (!city) return "City is required.";
  if (!postalCode) return "Postal code is required.";
  if (!/^[A-Z]{2}$/.test(country)) return "Country must be a 2-letter ISO code (e.g. GB).";

  return null;
}

export function buildLocationPayload(input: SellerAddressInput): Record<string, unknown> {
  return {
    name: "Seller Warehouse",
    locationTypes: ["WAREHOUSE"],
    merchantLocationStatus: "ENABLED",
    location: {
      address: {
        city: input.city.trim(),
        postalCode: input.postalCode.trim(),
        country: normalizeCountryCode(input.country),
      },
    },
  };
}

function parseEbayErrorMessage(bodyText: string, fallback: string): string {
  try {
    const data = JSON.parse(bodyText) as {
      errors?: Array<{ message?: string; longMessage?: string }>;
    };
    return data.errors?.[0]?.longMessage ?? data.errors?.[0]?.message ?? fallback;
  } catch {
    return bodyText || fallback;
  }
}

async function ebayLocationFetch(
  label: string,
  url: string,
  init: RequestInit,
): Promise<{ response: Response; bodyText: string }> {
  if (init.body) {
    console.log(`[eBay inventory_location ${label}] Payload:`, init.body);
  }

  const response = await fetch(url, init);
  const bodyText = await response.text();

  console.log(`[eBay inventory_location ${label}] Status:`, response.status);
  console.log(`[eBay inventory_location ${label}] Response:`, bodyText);

  return { response, bodyText };
}

export async function createEbayInventoryLocation(
  token: string,
  marketplaceId: EbayMarketplaceId,
  merchantLocationKey: string,
  body: Record<string, unknown>,
): Promise<void> {
  const requestUrl = `${EBAY_API_BASE}/sell/inventory/v1/location/${encodeURIComponent(merchantLocationKey)}`;
  const payload = JSON.stringify(body, null, 2);
  const { response, bodyText } = await ebayLocationFetch("POST create", requestUrl, {
    method: "POST",
    headers: inventoryHeaders(token, marketplaceId),
    body: payload,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(parseEbayErrorMessage(bodyText, "Failed to create eBay inventory location."));
  }
}

export async function updateEbayInventoryLocation(
  token: string,
  marketplaceId: EbayMarketplaceId,
  merchantLocationKey: string,
  body: Record<string, unknown>,
): Promise<void> {
  const requestUrl = `${EBAY_API_BASE}/sell/inventory/v1/location/${encodeURIComponent(merchantLocationKey)}/update_location_details`;
  const payload = JSON.stringify(body, null, 2);
  const { response, bodyText } = await ebayLocationFetch("POST update", requestUrl, {
    method: "POST",
    headers: inventoryHeaders(token, marketplaceId),
    body: payload,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(parseEbayErrorMessage(bodyText, "Failed to update eBay inventory location."));
  }
}

export async function requireConfirmedLocation(sellerId: string): Promise<EbaySellerInventoryLocation> {
  const location = await getSellerInventoryLocation(sellerId);

  if (!location?.addressConfirmed || !location.merchantLocationKey.trim()) {
    throw new Error(
      "Warehouse address is not set up. Enter your eBay registration address before listing.",
    );
  }

  if (!location.country.trim()) {
    throw new Error(
      "Warehouse address is missing a country code. Update your warehouse address in settings.",
    );
  }

  return location;
}

export async function setupSellerInventoryLocation(
  sellerId: string,
  address: SellerAddressInput,
): Promise<EbaySellerInventoryLocation> {
  const validationError = validateSellerAddress(address);
  if (validationError) throw new Error(validationError);

  const existing = await getSellerInventoryLocation(sellerId);
  if (existing?.addressConfirmed) {
    throw new Error("Warehouse address is already set up for this seller.");
  }

  const token = await getEbayUserAccessToken(sellerId);
  if (!token) {
    throw new Error("eBay account is not connected. Connect your eBay account first.");
  }

  const marketplaceId = await getSellerMarketplaceId(sellerId);
  const merchantLocationKey = buildMerchantLocationKey(sellerId);
  const payload = buildLocationPayload(address);

  await createEbayInventoryLocation(token, marketplaceId, merchantLocationKey, payload);

  return insertSellerInventoryLocation({
    sellerId,
    city: address.city.trim(),
    postalCode: address.postalCode.trim(),
    country: normalizeCountryCode(address.country),
    merchantLocationKey,
  });
}

export async function updateSellerInventoryLocationOnEbay(
  sellerId: string,
  address: SellerAddressInput,
): Promise<EbaySellerInventoryLocation> {
  const validationError = validateSellerAddress(address);
  if (validationError) throw new Error(validationError);

  const existing = await requireConfirmedLocation(sellerId);

  const token = await getEbayUserAccessToken(sellerId);
  if (!token) {
    throw new Error("eBay account is not connected. Connect your eBay account first.");
  }

  const marketplaceId = await getSellerMarketplaceId(sellerId);
  const payload = buildLocationPayload(address);

  await updateEbayInventoryLocation(
    token,
    marketplaceId,
    existing.merchantLocationKey,
    payload,
  );

  return updateSellerInventoryLocation({
    sellerId,
    city: address.city.trim(),
    postalCode: address.postalCode.trim(),
    country: normalizeCountryCode(address.country),
  });
}
