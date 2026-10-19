import { NextRequest, NextResponse } from "next/server";
import { isAiAuthError } from "@/lib/gemini/client";
import { checkVeroSafety, checkVeroSafetyForDraft } from "@/lib/gemini/vero-check";
import { fetchListingProductSource } from "@/lib/listings/product-source";
import { logUserApiRequest } from "@/lib/requests/tracker";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type { ListingDraft, ListingProductSource } from "@/types/listing-generator";

export const maxDuration = 60;

const PRODUCT_FETCH_TIMEOUT_MS = 25_000;
const VERO_CHECK_TIMEOUT_MS = 45_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s. Please retry.`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function POST(request: NextRequest) {
  let userId: string | null = null;

  try {
    const body = (await request.json()) as {
      userId?: string;
      url?: string;
      product?: ListingProductSource;
      title?: string;
      draft?: ListingDraft;
      finalCheck?: boolean;
    };

    userId = body.userId?.trim() ?? null;

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    if (body.finalCheck && body.draft) {
      const vero = await withTimeout(
        checkVeroSafetyForDraft(body.draft),
        VERO_CHECK_TIMEOUT_MS,
        "VeRO check",
      );
      void logUserApiRequest({
        userId,
        endpoint: "/api/vero-check",
        method: "POST",
        status: "success",
      });
      return NextResponse.json({ success: true, vero });
    }

    let product = body.product ?? null;

    if (!product) {
      if (!body.url?.trim()) {
        return NextResponse.json(
          { error: "AliExpress product URL or product data is required." },
          { status: 400 },
        );
      }
      product = await withTimeout(
        fetchListingProductSource(body.url.trim()),
        PRODUCT_FETCH_TIMEOUT_MS,
        "AliExpress product fetch",
      );
    }

    const vero = await withTimeout(
      checkVeroSafety(product, body.title),
      VERO_CHECK_TIMEOUT_MS,
      "VeRO check",
    );

    void logUserApiRequest({
      userId,
      endpoint: "/api/vero-check",
      method: "POST",
      status: "success",
    });

    return NextResponse.json({ success: true, product, vero });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "VeRO check failed.";
    if (userId) {
      void logUserApiRequest({
        userId,
        endpoint: "/api/vero-check",
        method: "POST",
        status: "failed",
      });
    }

    if (isAiAuthError(error)) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    const timedOut = /timed out/i.test(message);
    return NextResponse.json(
      { error: message },
      { status: timedOut ? 504 : 500 },
    );
  }
}
