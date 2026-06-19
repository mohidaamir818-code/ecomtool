import { NextRequest, NextResponse } from "next/server";
import { adminApiNotFound, requireAdminApi } from "@/lib/admin/require-admin-api";
import { increaseDailyLimit } from "@/lib/quota/service";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { QuotaPlatform } from "@/types/quota";

const PLATFORMS: QuotaPlatform[] = ["ebay", "aliexpress", "amazef"];

export async function POST(request: NextRequest) {
  const denied = requireAdminApi(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      userId?: string;
      platform?: QuotaPlatform;
      newLimit?: number | null;
      adminEmail?: string;
    };

    if (!body.userId?.trim() || !body.platform || !PLATFORMS.includes(body.platform)) {
      return adminApiNotFound();
    }

    if (body.newLimit !== null && (body.newLimit === undefined || body.newLimit < 0)) {
      return adminApiNotFound();
    }

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("id", body.userId)
      .single();

    if (!profile) {
      return adminApiNotFound();
    }

    const adminEmail = body.adminEmail?.trim() || "admin";
    const result = await increaseDailyLimit(
      body.userId,
      body.platform,
      body.newLimit ?? null,
      adminEmail,
      String(profile.email),
    );

    return NextResponse.json({ success: true, ...result });
  } catch {
    return adminApiNotFound();
  }
}
