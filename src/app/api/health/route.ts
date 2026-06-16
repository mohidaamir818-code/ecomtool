import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "amazef-arbitrage-tool",
    timestamp: new Date().toISOString(),
  });
}
