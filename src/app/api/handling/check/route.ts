import { NextRequest, NextResponse } from "next/server";
import { checkHandlingProductUpdate, getHandlingProducts } from "@/lib/handling/service";
import { logUserApiRequest } from "@/lib/requests/tracker";
import { consumeQuota } from "@/lib/quota/service";
import { quotaErrorResponse } from "@/lib/quota/api-helpers";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  let trackedUserId: string | null = null;

  try {
    const body = (await request.json()) as { userId?: string; productId?: string };
    trackedUserId = body.userId?.trim() ?? null;

    if (!body.userId?.trim() || !body.productId?.trim()) {
      return NextResponse.json({ error: "userId and productId are required." }, { status: 400 });
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

    const result = await checkHandlingProductUpdate(body.userId, body.productId);
    const products = await getHandlingProducts(body.userId);

    void logUserApiRequest({
      userId: body.userId,
      endpoint: "/api/handling/check",
      method: "POST",
      status: "success",
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      changes: result.changes,
      product: result.product,
      products,
    });
  } catch (error) {
    const quotaResponse = quotaErrorResponse(error);
    if (quotaResponse) return quotaResponse;

    const message = error instanceof Error ? error.message : "Failed to check product update.";
    if (trackedUserId) {
      void logUserApiRequest({
        userId: trackedUserId,
        endpoint: "/api/handling/check",
        method: "POST",
        status: "failed",
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
