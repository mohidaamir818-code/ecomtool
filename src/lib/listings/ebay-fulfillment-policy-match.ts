import type { EbayPolicyOption } from "@/types/listing-generator";

export interface ParsedDeliveryDays {
  minDays: number;
  maxDays: number;
}

export function parseDeliveryDaysFromText(text: string): ParsedDeliveryDays | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const rangeMatch = normalized.match(
    /(\d+)\s*(?:to|-|–)\s*(\d+)\s*(?:business\s*|working\s*)?(?:day|days|business days)/i,
  );
  if (rangeMatch) {
    const first = Number(rangeMatch[1]);
    const second = Number(rangeMatch[2]);
    if (Number.isFinite(first) && Number.isFinite(second)) {
      return { minDays: Math.min(first, second), maxDays: Math.max(first, second) };
    }
  }

  const withinMatch = normalized.match(
    /within\s+(\d+)\s*(?:business\s*|working\s*)?(?:day|days|business days)/i,
  );
  if (withinMatch) {
    const days = Number(withinMatch[1]);
    if (Number.isFinite(days)) return { minDays: days, maxDays: days };
  }

  const singleMatch = normalized.match(
    /(\d+)\s*(?:business\s*|working\s*)?(?:day|days|business days)/i,
  );
  if (singleMatch) {
    const days = Number(singleMatch[1]);
    if (Number.isFinite(days)) return { minDays: days, maxDays: days };
  }

  return null;
}

/**
 * Pick a fulfillment policy whose promised delivery is longer than AliExpress.
 * Prefers the tightest qualifying policy (smallest max days still above AliExpress).
 */
export function selectFulfillmentPolicyForAliExpress(
  policies: EbayPolicyOption[],
  aliExpressMaxDays: number | null,
): EbayPolicyOption | null {
  if (policies.length === 0) return null;
  if (aliExpressMaxDays == null) return policies[0];

  const ranked = policies
    .map((policy) => {
      const days = parseDeliveryDaysFromText(`${policy.name} ${policy.description ?? ""}`);
      if (!days) return null;
      return { policy, days };
    })
    .filter((entry): entry is { policy: EbayPolicyOption; days: ParsedDeliveryDays } => entry !== null)
    .filter((entry) => entry.days.maxDays > aliExpressMaxDays)
    .sort((a, b) => a.days.maxDays - b.days.maxDays || a.days.minDays - b.days.minDays);

  if (ranked.length > 0) return ranked[0].policy;

  const fallback = policies
    .map((policy) => ({
      policy,
      days: parseDeliveryDaysFromText(`${policy.name} ${policy.description ?? ""}`),
    }))
    .filter((entry): entry is { policy: EbayPolicyOption; days: ParsedDeliveryDays } =>
      Boolean(entry.days),
    )
    .sort((a, b) => b.days.maxDays - a.days.maxDays)[0];

  if (fallback && fallback.days.maxDays > aliExpressMaxDays) {
    return fallback.policy;
  }

  return null;
}
