import "server-only";

import { serverEnv } from "@/lib/env";
import { getAmazefEmail } from "@/lib/amazef/connection";
import { normalizeAmazefHandlingTimeLabel } from "@/features/listings/lib/amazef-auto-listing";
import { fetchAliExpressShippingDaysLabel } from "@/lib/listings/aliexpress-shipping-days";
import type { ListingDraft, ListOnEbayResult } from "@/types/listing-generator";

const AMAZEF_FETCH_TIMEOUT_MS = 30000;
const AMAZEF_PUBLIC_ORIGIN = "https://amazef.com";

export class AmazefListingError extends Error {
  status: number;
  rawBody: string;

  constructor(message: string, status: number, rawBody: string) {
    super(message);
    this.name = "AmazefListingError";
    this.status = status;
    this.rawBody = rawBody;
  }
}

interface AmazefCreateResponse {
  success?: boolean;
  productId?: string | number;
  listingUrl?: string;
  sku?: string;
  error?: string;
  hint?: string;
}

/**
 * Promotions the Amazef agent should apply after creating the listing. Built from
 * the seller's review-page Flash Sale / BOGO settings.
 */
export interface AmazefPromotionPayload {
  /** Lowest price (in the listing currency) that still keeps the seller's minimum profit. */
  floorPrice?: number;
  bogo?: {
    enabled: true;
    rule?: string;
    eligibleVariantIds?: string[];
    eligibleVariants?: Array<{ id: string; label: string }>;
    customGifts?: Array<{
      id: string;
      title: string;
      description: string;
      imageUrl: string;
    }>;
  };
  flashSale?: {
    enabled: true;
    rule?: string;
    keepPrice?: boolean;
    originalPrice?: number;
    flashSalePrice?: number;
    discountPercent: number;
  };
}

async function resolveShippingDaysLabelSafe(
  draft: ListingDraft,
): Promise<string | null> {
  const existing = draft.product.shippingDaysLabel?.trim() || null;
  if (existing) return existing;
  if (!draft.product.productUrl) return null;

  // Never block / crash listing on AliExpress shipping lookup.
  try {
    return await Promise.race([
      fetchAliExpressShippingDaysLabel(draft.product.productUrl),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 8_000);
      }),
    ]);
  } catch (error) {
    console.warn("[Amazef list] shipping days lookup skipped:", error);
    return null;
  }
}

function mapAmazefCreateFailure(
  status: number,
  payload: AmazefCreateResponse | null,
  rawBody: string,
  statusText: string,
  meta?: { baseUrl?: string; secretLen?: number },
): AmazefListingError {
  const remoteError = payload?.error?.trim() || "";
  const remoteHint = payload?.hint?.trim() || "";

  if (status === 401 || /unauthorized/i.test(remoteError)) {
    const host = (() => {
      try {
        return meta?.baseUrl ? new URL(meta.baseUrl).host : "unknown-host";
      } catch {
        return "unknown-host";
      }
    })();
    return new AmazefListingError(
      [
        "Amazef rejected the listing secret (Unauthorized).",
        `Host=${host}, secretLen=${meta?.secretLen ?? 0}.`,
        "Set the SAME AMAZEF_LISTING_SECRET on Amazef Railway and this app (Vercel), with no quotes/spaces, then redeploy BOTH.",
        remoteHint,
      ]
        .filter(Boolean)
        .join(" "),
      401,
      rawBody,
    );
  }

  const message =
    remoteError ||
    `Amazef listing failed (${status}): ${rawBody.slice(0, 200) || statusText || "no response body"}`;

  // Upstream Amazef 5xx → 502 so this app's own crashes stay distinguishable.
  const mappedStatus = status >= 500 ? 502 : status >= 400 ? status : 502;
  return new AmazefListingError(message, mappedStatus, rawBody);
}

export async function listDraftOnAmazef(
  userId: string,
  draft: ListingDraft,
  promotions?: AmazefPromotionPayload,
): Promise<ListOnEbayResult> {
  const baseUrl = serverEnv.amazefListingUrl();
  if (!baseUrl) {
    throw new AmazefListingError(
      "AMAZEF_LISTING_API_URL is not configured. Add it to your environment.",
      500,
      "",
    );
  }

  const secret = serverEnv.amazefListingSecret();
  if (!secret) {
    throw new AmazefListingError(
      "AMAZEF_LISTING_SECRET is not configured. Add the same secret used by Amazef, then redeploy.",
      500,
      "",
    );
  }

  const amazefEmail = await getAmazefEmail(userId);
  if (!amazefEmail) {
    throw new AmazefListingError(
      "Amazef account is not connected. Connect your Amazef account first.",
      400,
      "",
    );
  }

  const shippingDaysLabel = await resolveShippingDaysLabelSafe(draft);

  const handlingTimeLabel = normalizeAmazefHandlingTimeLabel(
    draft.product.handlingTimeLabel,
    "1 day",
  );

  const listingDraft = normalizeDraftForAmazef(draft, shippingDaysLabel, handlingTimeLabel);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AMAZEF_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/listings/create`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        userId,
        externalUserRef: amazefEmail,
        draft: listingDraft,
        shippingDays: shippingDaysLabel,
        deliveryTime: shippingDaysLabel,
        handlingTime: handlingTimeLabel,
        ...(promotions && Object.keys(promotions).length > 0 ? { promotions } : {}),
      }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    const aborted =
      (error instanceof Error && error.name === "AbortError") ||
      (typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name?: string }).name === "AbortError");

    if (aborted) {
      throw new AmazefListingError(
        "Amazef listing timed out after 30s. Check Amazef /api/listings/create is healthy, then retry.",
        504,
        "",
      );
    }

    throw new AmazefListingError(
      `Could not reach Amazef listing API: ${error instanceof Error ? error.message : "network error"}`,
      502,
      "",
    );
  } finally {
    clearTimeout(timeout);
  }

  const rawBody = await response.text().catch(() => "");
  const payload = parseJsonSafe<AmazefCreateResponse | null>(rawBody, null);

  console.log("[Amazef list] create response", {
    status: response.status,
    ok: response.ok,
    hasPayload: Boolean(payload),
    error: payload?.error ?? null,
    bodyPreview: rawBody.replace(/\s+/g, " ").slice(0, 240),
  });

  if (!response.ok || !payload || payload.success === false) {
    throw mapAmazefCreateFailure(response.status, payload, rawBody, response.statusText, {
      baseUrl,
      secretLen: secret.length,
    });
  }

  return {
    sku: payload.sku ? String(payload.sku) : (draft.product.internalProductSku ?? ""),
    offerId: payload.productId != null ? String(payload.productId) : "",
    listingId: payload.productId != null ? String(payload.productId) : null,
    listingUrl: resolveAmazefListingUrl(payload.listingUrl, payload.productId),
    variants: draft.variants.map((variant) => {
      const source = draft.product.variants?.find((entry) => entry.id === variant.id);
      return {
        sku: variant.sku,
        offerId: payload.productId != null ? String(payload.productId) : "",
        label: variant.label,
        price: variant.price > 0 ? variant.price : draft.listing.suggestedPrice,
        quantity: resolveSellableQuantity(variant),
        aliVariantId: variant.id,
        aliPrice: variant.aliExpressPrice ?? source?.price ?? draft.product.price,
        aliStock: source?.stock ?? draft.product.stock,
      };
    }),
  };
}

function resolveAmazefListingUrl(
  listingUrl: string | null | undefined,
  productId: string | number | null | undefined,
): string | null {
  const productIdStr = productId != null ? String(productId).trim() : "";
  const fallbackUrl = productIdStr ? `${AMAZEF_PUBLIC_ORIGIN}/products/${productIdStr}` : null;

  if (!listingUrl?.trim()) {
    return fallbackUrl;
  }

  const trimmed = listingUrl.trim();
  try {
    const parsed = new URL(trimmed);
    const isLocalhost =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname.endsWith(".local");

    if (isLocalhost) {
      const path =
        parsed.pathname && parsed.pathname !== "/"
          ? parsed.pathname
          : productIdStr
            ? `/products/${productIdStr}`
            : "";
      return path ? `${AMAZEF_PUBLIC_ORIGIN}${path}` : fallbackUrl;
    }

    return trimmed;
  } catch {
    if (trimmed.startsWith("/")) {
      return `${AMAZEF_PUBLIC_ORIGIN}${trimmed}`;
    }
    return fallbackUrl ?? trimmed;
  }
}

function resolveSellableQuantity(variant: ListingDraft["variants"][number]): number {
  if (variant.quantity >= 1) return variant.quantity;
  if (variant.stock >= 1) return variant.stock;
  return 1;
}

/** Amazef reads variant.stock; the wizard edits variant.quantity (same as eBay). */
function normalizeDraftForAmazef(
  draft: ListingDraft,
  shippingDaysLabel: string | null,
  handlingTimeLabel: string | null,
): ListingDraft {
  const variants = draft.variants.map((variant) => {
    const sellable = resolveSellableQuantity(variant);
    return {
      ...variant,
      stock: sellable,
      quantity: sellable,
    };
  });

  const productStock =
    variants.length === 1
      ? variants[0].stock
      : variants.reduce((sum, variant) => sum + variant.stock, 0);

  return {
    ...draft,
    variants,
    product: {
      ...draft.product,
      stock: productStock,
      ...(shippingDaysLabel ? { shippingDaysLabel } : {}),
      ...(handlingTimeLabel ? { handlingTimeLabel } : {}),
    },
  };
}

function parseJsonSafe<T>(bodyText: string, fallback: T): T {
  if (!bodyText.trim()) return fallback;
  try {
    return JSON.parse(bodyText) as T;
  } catch {
    return fallback;
  }
}
