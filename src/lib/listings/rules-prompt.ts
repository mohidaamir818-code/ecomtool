import "server-only";

import { generateAiJson } from "@/lib/gemini/client";

export type RulesPlatform = "ebay" | "amazef";

/**
 * Fields the AI is allowed to set from a seller's natural-language instruction.
 * Kept loose (Partial, unknown values) — the caller normalizes/clamps everything
 * through the existing settings normalizers, so the AI can never produce an
 * invalid or unsafe value.
 */
export type ParsedRuleSettings = Record<string, unknown>;

export interface RulesParseResult {
  understood: boolean;
  /** Short plain-language summary of what was understood, in the seller's language. */
  summary: string;
  /** When not understood: a message (seller's language) asking them to rewrite. */
  clarification: string | null;
  /** Partial settings to merge into the form (only the fields the seller mentioned). */
  settings: ParsedRuleSettings;
}

const EBAY_FIELDS = `
- platformFeePercent (number) — eBay fee %
- minProfitPercent (number) — minimum profit %, the seller is never allowed to lose money below this
- maxProfitPercent (number) — maximum profit %
- minStock (number), maxStock (number)
- smartPricingEnabled (boolean) — price just below the live eBay market average
- undercutMode ("auto" | "percent" | "amount") — how far below the market average to price
- marketUndercutPercent (number) — used when undercutMode is "percent"
- marketUndercutAmount (number) — used when undercutMode is "amount" (money below the average)
- charmPricingEnabled (boolean) — always end prices at .99
- autoPromoteEnabled (boolean) — add listings to eBay Promoted Listings automatically
- autoPromoteMinProfit (number) — only promote when per-item profit (money) is at least this
- autoPromoteAdRatePercent (number) — Promoted Listings ad rate %
- listVeroProducts (boolean)
`;

const AMAZEF_FIELDS = `
- platformFeePercent (number) — Amazef fee %
- minProfitPercent (number) — minimum profit %, the seller is never allowed to lose money below this
- maxProfitPercent (number) — maximum profit %
- minStock (number), maxStock (number)
- smartPricingEnabled (boolean) — price just below the live market average
- undercutMode ("auto" | "percent" | "amount") — how far below the market average to price
- marketUndercutPercent (number) — used when undercutMode is "percent"
- marketUndercutAmount (number) — used when undercutMode is "amount" (money below the average)
- charmPricingEnabled (boolean) — always end prices at .99
- listVeroProducts (boolean)
`;

function buildPrompt(
  platform: RulesPlatform,
  instruction: string,
  currentSettings: Record<string, unknown>,
): string {
  const fields = platform === "amazef" ? AMAZEF_FIELDS : EBAY_FIELDS;

  return `You are a configuration assistant for an e-commerce auto-listing tool.
A seller will describe, in plain English or Urdu (Roman or script), how they want their
${platform === "amazef" ? "Amazef" : "eBay"} auto-listing pricing and promotion rules to work.
Convert their instruction into structured settings.

Only these fields can be set:
${fields}

Rules:
- Only include fields the seller actually mentions or clearly implies. Leave everything else out.
- Never output a value that would make the seller lose money. If they ask to price below cost,
  set understood=false and explain in the clarification.
- If the instruction is clear, set "understood": true and write a short "summary" describing
  exactly what you will apply. IMPORTANT: write the summary in the SAME language and script the
  seller used (English, Roman Urdu, or Urdu).
- If the instruction is unclear, ambiguous, or you are not confident, set "understood": false,
  leave "settings" empty, and write a "clarification" message (in the seller's language) asking
  them to rewrite more clearly with a concrete example.

Current settings (for reference, only change what the seller asks):
${JSON.stringify(currentSettings)}

Seller instruction:
"""${instruction}"""

Respond with ONLY valid JSON in this exact shape:
{
  "understood": boolean,
  "summary": string,
  "clarification": string | null,
  "settings": { ...only the fields to change... }
}`;
}

export async function parseRulesPrompt(input: {
  platform: RulesPlatform;
  instruction: string;
  currentSettings: Record<string, unknown>;
}): Promise<RulesParseResult> {
  const instruction = input.instruction.trim();
  if (instruction.length < 3) {
    return {
      understood: false,
      summary: "",
      clarification: "Please describe your pricing or promotion rules.",
      settings: {},
    };
  }

  const prompt = buildPrompt(input.platform, instruction, input.currentSettings);

  const result = await generateAiJson<Partial<RulesParseResult>>(prompt, { maxTokens: 800 });

  const understood = Boolean(result.understood);
  return {
    understood,
    summary: typeof result.summary === "string" ? result.summary : "",
    clarification:
      typeof result.clarification === "string" && result.clarification.trim()
        ? result.clarification.trim()
        : understood
          ? null
          : "I could not understand that. Please rewrite your rules with a clear example.",
    settings:
      understood && result.settings && typeof result.settings === "object"
        ? (result.settings as ParsedRuleSettings)
        : {},
  };
}
