import { NextRequest, NextResponse } from "next/server";
import { parseRulesPrompt, type RulesPlatform } from "@/lib/listings/rules-prompt";

export const dynamic = "force-dynamic";

function normalizePlatform(value: unknown): RulesPlatform {
  return value === "amazef" ? "amazef" : "ebay";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      platform?: unknown;
      instruction?: unknown;
      currentSettings?: Record<string, unknown>;
    };

    const instruction = typeof body.instruction === "string" ? body.instruction : "";
    if (!instruction.trim()) {
      return NextResponse.json({ error: "instruction is required." }, { status: 400 });
    }

    const result = await parseRulesPrompt({
      platform: normalizePlatform(body.platform),
      instruction,
      currentSettings:
        body.currentSettings && typeof body.currentSettings === "object"
          ? body.currentSettings
          : {},
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not understand your rules. Try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
