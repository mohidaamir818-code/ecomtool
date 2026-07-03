import "server-only";

import { generateAiJson } from "@/lib/gemini/client";
import type { EbayPolicyOption } from "@/types/listing-generator";

interface AiFulfillmentPolicyPick {
  policyId?: string;
  reason?: string;
}

function buildPolicySelectionPrompt(input: {
  aliExpressLabel: string | null;
  aliExpressMinDays: number | null;
  aliExpressMaxDays: number | null;
  policies: EbayPolicyOption[];
}): string {
  const policyList = input.policies.map((policy) => ({
    policyId: policy.policyId,
    name: policy.name,
    internalDetails: policy.description?.trim() || "No internal details returned by eBay.",
  }));

  return `You match AliExpress delivery times to the best eBay postage (fulfillment) policy for a dropshipping listing.

AliExpress delivery for this product:
- Display label: ${input.aliExpressLabel ?? "unknown"}
- Earliest delivery (~days from today): ${input.aliExpressMinDays ?? "unknown"}
- Latest delivery (~days from today): ${input.aliExpressMaxDays ?? "unknown"}

Available eBay fulfillment policies. Read the internalDetails carefully (handling time, shipping carrier, transit min/max days). Do NOT rely on the policy name alone.
${JSON.stringify(policyList, null, 2)}

Choose the single policy that gives buyers a delivery window closest to AliExpress:
- Earliest delivery should not be much earlier than AliExpress start.
- Latest delivery should be a little after AliExpress end (about 2–4 days), not weeks later.
- Prefer policies whose internal handling + shipping transit matches the AliExpress calendar/days.

Reply with JSON only:
{"policyId":"<must be one of the policyId values above>","reason":"one sentence"}`;
}

/** Code check: AI pick must reference a real fulfillment policy from the list. */
export function verifyAiFulfillmentPolicyPick(
  policyId: string | null | undefined,
  policies: EbayPolicyOption[],
): EbayPolicyOption | null {
  const id = policyId?.trim();
  if (!id) return null;
  return policies.find((policy) => policy.policyId === id) ?? null;
}

export async function selectFulfillmentPolicyWithAi(input: {
  aliExpressLabel: string | null;
  aliExpressMinDays: number | null;
  aliExpressMaxDays: number | null;
  policies: EbayPolicyOption[];
}): Promise<EbayPolicyOption | null> {
  const { policies } = input;
  if (policies.length === 0) return null;
  if (policies.length === 1) return policies[0];

  try {
    const prompt = buildPolicySelectionPrompt(input);
    const raw = await generateAiJson<AiFulfillmentPolicyPick>(prompt, { maxTokens: 512 });
    return verifyAiFulfillmentPolicyPick(raw.policyId, policies);
  } catch {
    return null;
  }
}
