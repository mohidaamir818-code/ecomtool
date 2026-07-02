import "server-only";

import { serverEnv } from "@/lib/env";
import { getAmazefEmail } from "@/lib/amazef/connection";
import { getListedProducts } from "@/lib/listings/listed-products-service";
import type { StoreImportListing, StoreImportVariant } from "@/types/store-import";

const AMAZEF_FETCH_TIMEOUT_MS = 25000;
const AMAZEF_PUBLIC_ORIGIN = "https://amazef.com";

interface AmazefStoreVariantRaw {
  id?: string | number;
  sku?: string;
  label?: string;
  title?: string;
  name?: string;
  optionLabel?: string;
  price?: number | string;
  quantity?: number | string;
  stock?: number | string;
  imageUrl?: string;
  image_url?: string;
}

interface AmazefStoreProductRaw {
  id?: string | number;
  productId?: string | number;
  listingId?: string | number;
  title?: string;
  name?: string;
  image?: string;
  imageUrl?: string;
  image_url?: string;
  currency?: string;
  price?: number | string;
  quantity?: number | string;
  stock?: number | string;
  sku?: string;
  variants?: AmazefStoreVariantRaw[];
}

function parseNumber(value: number | string | undefined, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toArray(payload: unknown): AmazefStoreProductRaw[] {
  if (Array.isArray(payload)) return payload as AmazefStoreProductRaw[];
  if (!payload || typeof payload !== "object") return [];
  const data = payload as Record<string, unknown>;
  if (Array.isArray(data.products)) return data.products as AmazefStoreProductRaw[];
  if (Array.isArray(data.listings)) return data.listings as AmazefStoreProductRaw[];
  if (Array.isArray(data.items)) return data.items as AmazefStoreProductRaw[];
  if (Array.isArray(data.data)) return data.data as AmazefStoreProductRaw[];
  return [];
}

function normalizeVariants(product: AmazefStoreProductRaw): StoreImportVariant[] {
  const variantRows = Array.isArray(product.variants) ? product.variants : [];
  if (variantRows.length > 0) {
    return variantRows.map((variant, index) => {
      const offerId = variant.id != null ? String(variant.id) : `${product.id ?? product.productId ?? "v"}-${index + 1}`;
      return {
        sku: variant.sku?.trim() || offerId,
        offerId,
        label:
          variant.label?.trim() ||
          variant.optionLabel?.trim() ||
          variant.title?.trim() ||
          variant.name?.trim() ||
          `Variant ${index + 1}`,
        price: parseNumber(variant.price, parseNumber(product.price, 0)),
        quantity: parseNumber(variant.quantity, parseNumber(variant.stock, 0)),
        imageUrl: variant.imageUrl ?? variant.image_url ?? product.imageUrl ?? product.image_url ?? product.image ?? null,
      };
    });
  }

  const listingId = String(product.id ?? product.productId ?? product.listingId ?? crypto.randomUUID());
  return [
    {
      sku: product.sku?.trim() || listingId,
      offerId: listingId,
      label: "Default",
      price: parseNumber(product.price, 0),
      quantity: parseNumber(product.quantity, parseNumber(product.stock, 0)),
      imageUrl: product.imageUrl ?? product.image_url ?? product.image ?? null,
    },
  ];
}

function normalizeListing(product: AmazefStoreProductRaw): StoreImportListing | null {
  const listingIdRaw = product.id ?? product.productId ?? product.listingId;
  if (listingIdRaw == null) return null;
  const listingId = String(listingIdRaw);
  const variants = normalizeVariants(product);
  const title = product.title?.trim() || product.name?.trim() || `Amazef product ${listingId}`;
  const imageUrl = product.imageUrl ?? product.image_url ?? product.image ?? variants[0]?.imageUrl ?? null;
  return {
    listingId,
    listingUrl: `${AMAZEF_PUBLIC_ORIGIN}/products/${listingId}`,
    title,
    imageUrl,
    currency: (product.currency ?? "GBP").toString(),
    variants,
    groupSku: variants.length > 1 ? listingId : null,
    linked: false,
    listedProductId: null,
    aliexpressUrl: null,
  };
}

async function fetchRemoteAmazefStore(email: string): Promise<StoreImportListing[]> {
  const baseUrl = serverEnv.amazefListingUrl();
  if (!baseUrl) return [];

  const secret = serverEnv.amazefListingSecret();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AMAZEF_FETCH_TIMEOUT_MS);

  const endpoints = ["/api/listings/seller", "/api/listings/by-user"];
  try {
    for (const endpoint of endpoints) {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
        },
        body: JSON.stringify({ externalUserRef: email }),
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) continue;
      const payload = (await response.json().catch(() => null)) as unknown;
      const rows = toArray(payload)
        .map(normalizeListing)
        .filter((row): row is StoreImportListing => row !== null);
      if (rows.length > 0) return rows;
    }
  } finally {
    clearTimeout(timeout);
  }

  return [];
}

export async function fetchSellerAmazefStore(userId: string): Promise<StoreImportListing[]> {
  const email = await getAmazefEmail(userId);
  if (!email) {
    throw new Error("Amazef account is not connected. Connect Amazef first.");
  }

  const remoteListings = await fetchRemoteAmazefStore(email);

  let savedByListingId = new Map<string, { id: string; aliexpressUrl: string }>();
  try {
    const saved = await getListedProducts(userId);
    savedByListingId = new Map(
      saved
        .filter((product) => product.platform === "amazef" && product.listingId)
        .map((product) => [
          String(product.listingId),
          { id: product.id, aliexpressUrl: product.aliexpressUrl },
        ]),
    );
  } catch {
    // Keep import usable when saved listings lookup fails.
  }

  return remoteListings
    .map((listing) => {
      const savedProduct = savedByListingId.get(String(listing.listingId));
      if (!savedProduct) return listing;
      return {
        ...listing,
        linked: true,
        listedProductId: savedProduct.id,
        aliexpressUrl: savedProduct.aliexpressUrl,
      };
    })
    .sort((a, b) => {
      if (a.linked === b.linked) return a.title.localeCompare(b.title);
      return a.linked ? 1 : -1;
    });
}
