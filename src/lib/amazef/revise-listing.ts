import "server-only";

import { serverEnv } from "@/lib/env";
import { getAmazefEmail } from "@/lib/amazef/connection";
import type { ListingDraft } from "@/types/listing-generator";

const AMAZEF_FETCH_TIMEOUT_MS = 30000;

export async function reviseAmazefListedVariants(
  userId: string,
  draft: ListingDraft,
  productId: string,
  variants: Array<{ aliVariantId: string; price: number; quantity: number }>,
): Promise<void> {
  const baseUrl = serverEnv.amazefListingUrl();
  if (!baseUrl) return;

  const amazefEmail = await getAmazefEmail(userId);
  if (!amazefEmail) return;

  const secret = serverEnv.amazefListingSecret();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AMAZEF_FETCH_TIMEOUT_MS);

  try {
    await fetch(`${baseUrl}/api/listings/update`, {
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
  } catch {
    // Best-effort until Amazef update API is available.
  } finally {
    clearTimeout(timeout);
  }
}
