import { NextRequest, NextResponse } from "next/server";
import { fetchAliExpressShippingDaysLabel } from "@/lib/listings/aliexpress-shipping-days";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")?.trim();
  if (!url) {
    return NextResponse.json({ error: "url is required." }, { status: 400 });
  }

  const shippingDaysLabel = await fetchAliExpressShippingDaysLabel(url);
  return NextResponse.json({ shippingDaysLabel });
}
