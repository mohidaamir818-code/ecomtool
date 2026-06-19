import { NextRequest, NextResponse } from "next/server";
import { QuotaExceededError } from "@/lib/quota/errors";
import { consumeQuota, quotaExceededToJson } from "@/lib/quota/service";
import { getSupabaseAdmin } from "@/lib/supabase/server";
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

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", body.userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const quota = await consumeQuota(body.userId, body.platform, body.count ?? 1);
    return NextResponse.json({ success: true, quota });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json(quotaExceededToJson(error), { status: 429 });
    }

    const message = error instanceof Error ? error.message : "Failed to use quota.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
