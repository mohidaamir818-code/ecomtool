import { NextRequest, NextResponse } from "next/server";
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

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message || "VeRO check failed." },
    { status },
  );
}

export async function POST(request: NextRequest) {
  let userId: string | null = null;

  try {
    let body: {
      userId?: string;
      url?: string;
      product?: ListingProductSource;
      title?: string;
      draft?: ListingDraft;
      finalCheck?: boolean;
    };

    try {
      body = (await request.json()) as typeof body;
    } catch {
      return jsonError("Invalid JSON body for VeRO check.", 400);
    }

    userId = body.userId?.trim() ?? null;

    if (!userId) {
      return jsonError("userId is required.", 400);
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
        return jsonError("AliExpress product URL or product data is required.", 400);
      }
      try {
        product = await withTimeout(
          fetchListingProductSource(body.url.trim()),
          PRODUCT_FETCH_TIMEOUT_MS,
          "AliExpress product fetch",
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch AliExpress product.";
        console.error("[VeRO] product fetch failed:", message);
        const timedOut = /timed out/i.test(message);
        return jsonError(
          timedOut
            ? "AliExpress product fetch timed out. Please retry."
            : `Could not load AliExpress product: ${message}`,
          timedOut ? 504 : 502,
        );
      }
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

    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "VeRO check failed.";
    console.error("[VeRO] check failed:", message);

    if (userId) {
      void logUserApiRequest({
        userId,
        endpoint: "/api/vero-check",
        method: "POST",
        status: "failed",
      });
    }

    const timedOut = /timed out/i.test(message);
    return jsonError(message, timedOut ? 504 : 500);
  }
}
