import { NextRequest, NextResponse } from "next/server";
import { runAmazefAutoListPipeline } from "@/lib/amazef/auto-list-pipeline";
import { AmazefListingError } from "@/lib/amazef/listing";
import type { AmazefAutoListingSettings } from "@/features/listings/lib/amazef-auto-listing";
import { logUserApiRequest } from "@/lib/requests/tracker";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export async function POST(request: NextRequest) {
  let userId: string | null = null;

  try {
    const body = (await request.json()) as {
      userId?: string;
      url?: string;
      settings?: Partial<AmazefAutoListingSettings>;
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

    const result = await runAmazefAutoListPipeline(userId, url, body.settings);

    void logUserApiRequest({
      userId,
      endpoint: "/api/amazef/auto-list",
      method: "POST",
      status: "success",
    });

    return NextResponse.json({
      success: true,
      message: "Product listed on Amazef. Check your email for confirmation.",
      result,
    });
  } catch (error: unknown) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Auto listing failed.";

    if (userId) {
      void logUserApiRequest({
        userId,
        endpoint: "/api/amazef/auto-list",
        method: "POST",
        status: "failed",
      });
    }

    const status =
      error instanceof AmazefListingError && error.status >= 400 && error.status < 500
        ? error.status
        : 500;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}
