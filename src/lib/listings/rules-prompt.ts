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
  /**
   * Optional one-time follow-up question (seller's language) — e.g. asking for
   * their fees when they configured pricing/profit but didn't mention any. The
   * parsed settings are still returned so the seller can answer or apply as-is.
   */
  question: string | null;
  /** Partial settings to merge into the form (only the fields the seller mentioned). */
  settings: ParsedRuleSettings;
}

const EBAY_FIELDS = `
- platformFeePercent (number) — eBay final value / platform fee %
- paymentFeePercent (number) — payment processing fee %
- transactionFeeAmount (number) — fixed per-order transaction fee (money)
- shippingCost (number) — the seller's shipping/postage cost (money)
- profitMarginPercent (number) — the seller's target profit margin %
- minProfitPercent (number) — minimum profit %, the seller is never allowed to lose money below this
- maxProfitPercent (number) — maximum profit %
- minStock (number), maxStock (number)
- smartPricingEnabled (boolean) — price just below the live eBay market average
- undercutMode ("auto" | "percent" | "amount") — how far below the market average to price
- marketUndercutPercent (number) — used when undercutMode is "percent"
- marketUndercutAmount (number) — used when undercutMode is "amount" (money below the average)
- charmPricingEnabled (boolean) — end prices at a charm value (.99 by default)
- charmRules (array) — OPTIONAL custom charm endings by price range. Each item is
  { "maxPrice": number|null, "ending": number(0-99) } meaning prices at or below maxPrice end at
  ".ending" cents; maxPrice null = all higher prices. Example: the seller says "agar £1 jaisa ho to
  .99, agar £1.80 ya £1.90 ho to .59, baqi .89" → set charmPricingEnabled true and charmRules
  [{"maxPrice":1.5,"ending":99},{"maxPrice":1.99,"ending":59},{"maxPrice":null,"ending":89}].
  The numbers the seller gives are EXAMPLES of ranges, never a single exact price only.
- autoPromoteEnabled (boolean) — add listings to eBay Promoted Listings automatically
- autoPromoteMinProfit (number) — only promote when per-item profit (money) is at least this
- autoPromoteAdRatePercent (number) — Promoted Listings ad rate %
- listVeroProducts (boolean)
`;

const AMAZEF_FIELDS = `
- platformFeePercent (number) — Amazef platform fee %
- paymentFeePercent (number) — payment processing fee %
- transactionFeeAmount (number) — fixed per-order transaction fee (money)
- shippingCost (number) — the seller's shipping/postage cost (money)
- profitMarginPercent (number) — the seller's target profit margin %
- minProfitPercent (number) — minimum profit %, the seller is never allowed to lose money below this
- maxProfitPercent (number) — maximum profit %
- minStock (number), maxStock (number)
- smartPricingEnabled (boolean) — price just below the live market average
- undercutMode ("auto" | "percent" | "amount") — how far below the market average to price
- marketUndercutPercent (number) — used when undercutMode is "percent"
- marketUndercutAmount (number) — used when undercutMode is "amount" (money below the average)
- charmPricingEnabled (boolean) — end prices at a charm value (.99 by default)
- charmRules (array) — OPTIONAL custom charm endings by price range. Each item is
  { "maxPrice": number|null, "ending": number(0-99) } meaning prices at or below maxPrice end at
  ".ending" cents; maxPrice null = all higher prices. Example: the seller says "agar £1 jaisa ho to
  .99, agar £1.80 ya £1.90 ho to .59, baqi .89" → set charmPricingEnabled true and charmRules
  [{"maxPrice":1.5,"ending":99},{"maxPrice":1.99,"ending":59},{"maxPrice":null,"ending":89}].
  The numbers the seller gives are EXAMPLES of ranges, never a single exact price only.
- bogoEnabled (boolean) — apply a Buy One Get One (BOGO) promotion
- bogoMinProfit (number) — only apply BOGO when per-item profit (money) is at least this
- bogoRule (string) — a short summary of the seller's BOGO rule, written in their own words/language
- flashSaleEnabled (boolean) — add the listing to a flash sale
- flashSaleKeepPrice (boolean) — set TRUE when the seller wants the REAL selling price to stay the
  SAME and only SHOW a higher "was" price / discount so buyers feel it is on sale (no real loss).
  Example: "price wahi rakho bas flash sale me upar discount dikhao" → flashSaleKeepPrice true.
- flashSaleDiscountPercent (number) — the discount % to show or apply in the flash sale
- flashSaleMinProfit (number) — only apply the flash sale when per-item profit (money) is at least this
- flashSaleRule (string) — a short summary of the seller's flash-sale rule, in their own words/language
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
- Profit RANGES: if the seller gives a range like "profit 25 to 35%", "25 se 35%", or "25-35%",
  map it to minProfitPercent=25 and maxProfitPercent=35. A single value like "35%" means
  minProfitPercent=35 (and you may leave maxProfitPercent unless they imply an upper bound).
- If the instruction is clear, set "understood": true and write a short "summary" describing
  exactly what you will apply. IMPORTANT: write the summary in the SAME language and script the
  seller used (English, Roman Urdu, or Urdu).
- FEES: if the seller configured profit/pricing/promotion but did NOT mention any fees
  (platformFeePercent or paymentFeePercent), AND the current settings still appear to use default
  fees, then keep "understood": true and still return the parsed settings, but set "question" to a
  short message (in the seller's language) asking them to also tell their platform/payment fees so
  the profit stays accurate. If fees were given or already set, "question" must be null.
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
  "question": string | null,
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
      question: null,
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
    question:
      understood && typeof result.question === "string" && result.question.trim()
        ? result.question.trim()
        : null,
    settings:
      understood && result.settings && typeof result.settings === "object"
        ? (result.settings as ParsedRuleSettings)
        : {},
  };
}
