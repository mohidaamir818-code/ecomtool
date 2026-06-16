import { NextRequest, NextResponse } from "next/server";
import { previewHandlingProduct } from "@/lib/handling/service";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { userId?: string; url?: string };

    if (!body.userId?.trim()) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!body.url?.trim()) {
      return NextResponse.json({ error: "AliExpress product URL is required." }, { status: 400 });
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

    const product = await previewHandlingProduct(body.url.trim());

    return NextResponse.json({ success: true, product });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to preview product.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
