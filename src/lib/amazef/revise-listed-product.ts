import "server-only";

import { serverEnv } from "@/lib/env";
import { getAmazefEmail } from "@/lib/amazef/connection";
import type { ListingDraft } from "@/types/listing-generator";

const AMAZEF_FETCH_TIMEOUT_MS = 30000;

export async function reviseAmazefListedProduct(
  userId: string,
  draft: ListingDraft,
  productId: string,
  variants: Array<{ aliVariantId: string; price: number; quantity: number }>,
): Promise<void> {
  const baseUrl = serverEnv.amazefListingUrl();
  if (!baseUrl) {
    throw new Error("Amazef listing service is not configured.");
  }

  const amazefEmail = await getAmazefEmail(userId);
  if (!amazefEmail) {
    throw new Error("Amazef account is not connected.");
  }

  const secret = serverEnv.amazefListingSecret();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AMAZEF_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/api/listings/update`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({
        userId,
        externalUserRef: amazefEmail,
        productId,
        draft,
        variants,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(body || "Failed to update listing on Amazef.");
    }
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Failed to update listing on Amazef.");
  } finally {
    clearTimeout(timeout);
  }
}
