import { NextRequest, NextResponse } from "next/server";
import { extractAliExpressProductId } from "@/lib/aliexpress/client";
import { checkHandlingProductUpdate } from "@/lib/handling/service";
import { getSupabaseAdmin } from "@/lib/supabase/server";

function verifySecret(request: NextRequest): boolean {
  const secret = process.env.ALIEXPRESS_WEBHOOK_SECRET?.trim();
  if (!secret) return true; // mirror cron: permissive when unset (dev)
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  if (request.headers.get("x-aliexpress-webhook-secret") === secret) return true;
  return request.nextUrl.searchParams.get("secret") === secret;
}

interface WebhookBody {
  productId?: string | number;
  product_id?: string | number;
  externalId?: string | number;
  productUrl?: string;
  product_url?: string;
  url?: string;
}

function resolveExternalId(body: WebhookBody): string | null {
  const direct = body.productId ?? body.product_id ?? body.externalId;
  if (direct != null && String(direct).trim()) return String(direct).trim();
  const url = body.productUrl ?? body.product_url ?? body.url;
  return url ? extractAliExpressProductId(String(url)) : null;
}

export async function POST(request: NextRequest) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as WebhookBody;
    const externalId = resolveExternalId(body);

    if (!externalId) {
      return NextResponse.json({ error: "Missing AliExpress product id." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: rows, error } = await supabase
      .from("handling_products")
      .select("id, user_id")
      .eq("external_id", externalId)
      .eq("status", "active");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!rows?.length) {
      // Not tracked by anyone - acknowledge so AliExpress does not keep retrying.
      return NextResponse.json({ success: true, tracked: false, matched: 0 });
    }

    const results = await Promise.allSettled(
      rows.map((row) =>
        checkHandlingProductUpdate(String(row.user_id), String(row.id), { skipQuota: true }),
      ),
    );

    const processed = results.filter((result) => result.status === "fulfilled").length;

    return NextResponse.json({
      success: true,
      tracked: true,
      externalId,
      matched: rows.length,
      processed,
      failed: results.length - processed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process webhook.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
