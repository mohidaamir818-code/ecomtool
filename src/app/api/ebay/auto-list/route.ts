import { NextRequest, NextResponse } from "next/server";
import {
  EbayAutoListNeedsFulfillmentPolicyError,
  runEbayAutoListPipeline,
} from "@/lib/ebay/auto-list-pipeline";
import { EbayApiError } from "@/lib/ebay/sell-inventory";
import type { EbayAutoListingSettings } from "@/features/listings/lib/ebay-auto-listing";
import { logUserApiRequest } from "@/lib/requests/tracker";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export async function POST(request: NextRequest) {
  let userId: string | null = null;

  try {
    const body = (await request.json()) as {
      userId?: string;
      url?: string;
      settings?: Partial<EbayAutoListingSettings>;
      acknowledgeVero?: boolean;
      fulfillmentPolicyId?: string;
    };

    userId = body.userId?.trim() ?? null;
    const url = body.url?.trim() ?? "";

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!url) {
      return NextResponse.json({ error: "AliExpress product URL is required." }, { status: 400 });
    }

    if (!body.settings?.enabled) {
      return NextResponse.json({ error: "Auto listing is not enabled." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const result = await runEbayAutoListPipeline(userId, url, body.settings, {
      acknowledgeVero: body.acknowledgeVero,
      fulfillmentPolicyId: body.fulfillmentPolicyId?.trim() || undefined,
    });

    void logUserApiRequest({
      userId,
      endpoint: "/api/ebay/auto-list",
      method: "POST",
      status: "success",
    });

    return NextResponse.json({
      success: true,
      message: "Product listed on eBay. Check your email for confirmation.",
      result,
    });
  } catch (error: unknown) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    if (error instanceof EbayAutoListNeedsFulfillmentPolicyError) {
      return NextResponse.json({
        success: false,
        needsFulfillmentPolicySelection: true,
        aliExpressShippingLabel: error.aliExpressShippingLabel,
        fulfillmentPolicies: error.fulfillmentPolicies,
        paymentPolicyId: error.paymentPolicyId,
        returnPolicyId: error.returnPolicyId,
        error: error.message,
      });
    }

    const message = error instanceof Error ? error.message : "Auto listing failed.";

    if (userId) {
      void logUserApiRequest({
        userId,
        endpoint: "/api/ebay/auto-list",
        method: "POST",
        status: "failed",
      });
    }

    const status =
      error instanceof EbayApiError && error.status >= 400 && error.status < 500
        ? error.status
        : 500;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}
