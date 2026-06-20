import { NextRequest, NextResponse } from "next/server";
import {
  createSellerPolicyAndRefresh,
  ensureSellerPolicies,
} from "@/lib/ebay/business-policies";
import type { CreatePolicyType } from "@/types/listing-generator";
import { getSellerMarketplaceId } from "@/lib/ebay/marketplace";
import { getEbayUserAccessToken } from "@/lib/ebay/oauth-user";
import { getSupabaseAdmin } from "@/lib/supabase/server";

function parsePolicyType(value: string | null | undefined): CreatePolicyType | null {
  if (value === "fulfillment" || value === "payment" || value === "return") {
    return value;
  }
  return null;
}

async function resolveSellerContext(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  if (!profile) {
    return { error: NextResponse.json({ error: "User not found." }, { status: 404 }) };
  }

  const token = await getEbayUserAccessToken(userId);
  if (!token) {
    return { error: NextResponse.json({ error: "eBay account is not connected." }, { status: 400 }) };
  }

  const marketplaceId = await getSellerMarketplaceId(userId);
  return { token, marketplaceId };
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId")?.trim();
  try {
    const refresh = request.nextUrl.searchParams.get("refresh") === "true";

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const context = await resolveSellerContext(userId);
    if ("error" in context) return context.error;

    const policies = await ensureSellerPolicies(context.token, context.marketplaceId, {
      userId,
      refresh,
    });

    return NextResponse.json({
      success: true,
      marketplaceId: context.marketplaceId,
      ...policies,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load eBay policies.";
    console.error("[eBay Policies API] GET failed", { userId, error });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let userId: string | undefined;
  try {
    const body = (await request.json()) as {
      userId?: string;
      policyType?: string;
    };

    userId = body.userId?.trim();
    const policyType = parsePolicyType(body.policyType);

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!policyType) {
      return NextResponse.json(
        { error: "policyType must be fulfillment, payment, or return." },
        { status: 400 },
      );
    }

    const context = await resolveSellerContext(userId);
    if ("error" in context) return context.error;

    const policies = await createSellerPolicyAndRefresh(
      context.token,
      context.marketplaceId,
      userId,
      policyType,
    );

    return NextResponse.json({
      success: true,
      marketplaceId: context.marketplaceId,
      ...policies,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create eBay policy.";
    console.error("[eBay Policies API] POST failed", { userId, error });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
