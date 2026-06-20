import { NextResponse } from "next/server";
import { getEbayOAuthSetupStatus } from "@/lib/ebay/oauth-user";

export async function GET() {
  const setup = getEbayOAuthSetupStatus();
  return NextResponse.json({ success: true, ...setup });
}
