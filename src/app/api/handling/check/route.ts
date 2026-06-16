import { NextRequest, NextResponse } from "next/server";
import { checkHandlingProductUpdate, getHandlingProducts } from "@/lib/handling/service";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { userId?: string; productId?: string };

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

    return NextResponse.json({
      success: true,
      message: result.message,
      changes: result.changes,
      product: result.product,
      products,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to check product update.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
