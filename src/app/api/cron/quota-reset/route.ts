import { NextRequest, NextResponse } from "next/server";
import { resetAllDailyQuotas } from "@/lib/quota/service";

function verifyCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

export async function POST(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const resetCount = await resetAllDailyQuotas();
    return NextResponse.json({ success: true, resetCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reset quotas.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
