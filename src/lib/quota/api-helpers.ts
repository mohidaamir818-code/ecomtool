import { NextResponse } from "next/server";
import { QuotaExceededError } from "@/lib/quota/errors";
import { quotaExceededToJson } from "@/lib/quota/service";

export function quotaErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof QuotaExceededError) {
    return NextResponse.json(quotaExceededToJson(error), { status: 429 });
  }
  return null;
}
