import { NextRequest, NextResponse } from "next/server";
import { QuotaExceededError } from "@/lib/quota/errors";
import { consumeQuota, quotaExceededToJson } from "@/lib/quota/service";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type { QuotaPlatform } from "@/types/quota";

const PLATFORMS: QuotaPlatform[] = ["ebay", "aliexpress", "amazef"];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      platform?: QuotaPlatform;
      count?: number;
    };

    if (!body.userId?.trim()) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!body.platform || !PLATFORMS.includes(body.platform)) {
      return NextResponse.json({ error: "Valid platform is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(body.userId);
    if (accessDenied) return accessDenied;

    const quota = await consumeQuota(body.userId, body.platform, body.count ?? 1);
    return NextResponse.json({ success: true, quota });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    if (error instanceof QuotaExceededError) {
      return NextResponse.json(quotaExceededToJson(error), { status: 429 });
    }

    const message = error instanceof Error ? error.message : "Failed to use quota.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
