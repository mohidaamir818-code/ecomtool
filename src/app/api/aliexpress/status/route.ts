import { NextResponse } from "next/server";
import { getAliExpressTokenStatus } from "@/lib/aliexpress/oauth";

export async function GET() {
  const status = await getAliExpressTokenStatus();
  return NextResponse.json({ success: true, ...status });
}
