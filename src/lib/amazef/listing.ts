import "server-only";

import { serverEnv } from "@/lib/env";
import { getAmazefEmail } from "@/lib/amazef/connection";
import type { ListingDraft, ListOnEbayResult } from "@/types/listing-generator";

const AMAZEF_FETCH_TIMEOUT_MS = 30000;

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
}

export async function listDraftOnAmazef(
  userId: string,
  draft: ListingDraft,
): Promise<ListOnEbayResult> {
  const baseUrl = serverEnv.amazefListingUrl();
  if (!baseUrl) {
    throw new AmazefListingError(
      "AMAZEF_LISTING_API_URL is not configured. Add it to your environment.",
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

  const secret = serverEnv.amazefListingSecret();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AMAZEF_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/listings/create`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ userId, externalUserRef: amazefEmail, draft }),
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const rawBody = await response.text().catch(() => "");
  const payload = parseJsonSafe<AmazefCreateResponse | null>(rawBody, null);

  if (!response.ok || !payload || payload.success === false) {
    const message =
      payload?.error ||
      `Amazef listing failed (${response.status}): ${rawBody.slice(0, 200) || response.statusText}`;
    throw new AmazefListingError(message, response.status, rawBody);
  }

  return {
    sku: payload.sku ? String(payload.sku) : (draft.product.internalProductSku ?? ""),
    offerId: payload.productId != null ? String(payload.productId) : "",
    listingId: payload.productId != null ? String(payload.productId) : null,
    listingUrl: payload.listingUrl ?? null,
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
