import type { EbayPolicyOption } from "@/types/listing-generator";

export interface ParsedDeliveryDays {
  minDays: number;
  maxDays: number;
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const MONTH_PATTERN =
  "Jan(?:\\.?(?:uary)?)?|Feb(?:\\.?(?:ruary)?)?|Mar(?:\\.?(?:ch)?)?|Apr(?:\\.?(?:il)?)?|May\\.?|Jun(?:\\.?(?:e)?)?|Jul(?:\\.?(?:y)?)?|Aug(?:\\.?(?:ust)?)?|Sep(?:\\.?(?:t(?:ember)?)?)?|Oct(?:\\.?(?:ober)?)?|Nov(?:\\.?(?:ember)?)?|Dec(?:\\.?(?:ember)?)?";

function parseMonthName(value: string): number | null {
  const key = value.trim().slice(0, 3).toLowerCase();
  return MONTH_INDEX[key] ?? null;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function resolveDeliveryDate(month: number, day: number, reference: Date): Date {
  let year = reference.getFullYear();
  let candidate = new Date(year, month, day);
  if (candidate < startOfDay(reference)) {
    year += 1;
    candidate = new Date(year, month, day);
  }
  return candidate;
}

function daysUntil(reference: Date, target: Date): number {
  const diffMs = startOfDay(target).getTime() - startOfDay(reference).getTime();
  return Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));
}

function parseCalendarDateRange(
  text: string,
  referenceDate = new Date(),
): ParsedDeliveryDays | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const patterns: Array<{
    regex: RegExp;
    resolve: (match: RegExpMatchArray) => ParsedDeliveryDays | null;
  }> = [
    {
      regex: new RegExp(
        `\\b(${MONTH_PATTERN})\\s+(\\d{1,2})\\s*(?:-|–|~|to)\\s*(?:(${MONTH_PATTERN})\\s+)?(\\d{1,2})\\b`,
        "i",
      ),
      resolve: (match) => {
        const monthA = parseMonthName(match[1]);
        const dayA = Number(match[2]);
        const monthB = parseMonthName(match[3] ?? match[1]);
        const dayB = Number(match[4]);
        if (monthA == null || monthB == null) return null;
        const startDate = resolveDeliveryDate(monthA, dayA, referenceDate);
        const endDate = resolveDeliveryDate(monthB, dayB, referenceDate);
        return {
          minDays: daysUntil(referenceDate, startDate),
          maxDays: daysUntil(referenceDate, endDate),
        };
      },
    },
    {
      regex: new RegExp(
        `\\b(\\d{1,2})\\s+(${MONTH_PATTERN})\\s*(?:-|–|~|to)\\s*(\\d{1,2})\\s+(${MONTH_PATTERN})\\b`,
        "i",
      ),
      resolve: (match) => {
        const monthA = parseMonthName(match[2]);
        const dayA = Number(match[1]);
        const monthB = parseMonthName(match[4]);
        const dayB = Number(match[3]);
        if (monthA == null || monthB == null) return null;
        const startDate = resolveDeliveryDate(monthA, dayA, referenceDate);
        const endDate = resolveDeliveryDate(monthB, dayB, referenceDate);
        return {
          minDays: daysUntil(referenceDate, startDate),
          maxDays: daysUntil(referenceDate, endDate),
        };
      },
    },
    {
      regex: new RegExp(
        `\\b(\\d{1,2})\\s+(${MONTH_PATTERN})\\s*(?:-|–|~|to)\\s*(\\d{1,2})\\b`,
        "i",
      ),
      resolve: (match) => {
        const monthA = parseMonthName(match[2]);
        const dayA = Number(match[1]);
        const dayB = Number(match[3]);
        if (monthA == null) return null;
        const startDate = resolveDeliveryDate(monthA, dayA, referenceDate);
        const endDate = resolveDeliveryDate(monthA, dayB, referenceDate);
        return {
          minDays: daysUntil(referenceDate, startDate),
          maxDays: daysUntil(referenceDate, endDate),
        };
      },
    },
  ];

  for (const { regex, resolve } of patterns) {
    const match = normalized.match(regex);
    if (match) {
      const parsed = resolve(match);
      if (parsed && parsed.maxDays <= 90) return parsed;
    }
  }

  return null;
}

function parseExplicitDayCount(text: string): ParsedDeliveryDays | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const rangeMatch = normalized.match(
    /(\d+)\s*(?:to|-|–)\s*(\d+)\s*(?:business\s*|working\s*)?(?:day|days|business days)/i,
  );
  if (rangeMatch) {
    const first = Number(rangeMatch[1]);
    const second = Number(rangeMatch[2]);
    if (Number.isFinite(first) && Number.isFinite(second) && first <= 60 && second <= 60) {
      return { minDays: Math.min(first, second), maxDays: Math.max(first, second) };
    }
  }

  const withinMatch = normalized.match(
    /within\s+(\d+)\s*(?:business\s*|working\s*)?(?:day|days|business days)/i,
  );
  if (withinMatch) {
    const days = Number(withinMatch[1]);
    if (Number.isFinite(days) && days <= 60) return { minDays: days, maxDays: days };
  }

  const singleMatch = normalized.match(
    /(\d+)\s*(?:business\s*|working\s*)?(?:day|days|business days)/i,
  );
  if (singleMatch) {
    const days = Number(singleMatch[1]);
    if (Number.isFinite(days) && days <= 60) return { minDays: days, maxDays: days };
  }

  return null;
}

export function parseDeliveryDaysFromText(
  text: string,
  referenceDate = new Date(),
): ParsedDeliveryDays | null {
  return parseExplicitDayCount(text) ?? parseCalendarDateRange(text, referenceDate);
}

function policyDeliveryText(policy: EbayPolicyOption): string {
  return `${policy.name} ${policy.description ?? ""}`.replace(/\s+/g, " ").trim();
}

function scorePolicyMatch(
  policyDays: ParsedDeliveryDays,
  aliMin: number,
  aliMax: number,
): number {
  const bufferMax = aliMax + 2;
  const underAliMax = policyDays.maxDays < aliMax ? (aliMax - policyDays.maxDays) * 25 : 0;
  const overBuffer = policyDays.maxDays > bufferMax ? (policyDays.maxDays - bufferMax) * 4 : 0;
  const minGap = Math.abs(policyDays.minDays - aliMin);
  const maxGap = Math.abs(policyDays.maxDays - bufferMax);
  return underAliMax + overBuffer + minGap + maxGap;
}

/**
 * Pick the fulfillment policy whose delivery window best matches AliExpress.
 * Reads policy name + description (handling time, shipping services, etc.) and
 * prefers a policy within ~1–2 days above the AliExpress max delivery time.
 */
export function selectFulfillmentPolicyForAliExpress(
  policies: EbayPolicyOption[],
  aliExpressMaxDays: number | null,
  aliExpressMinDays: number | null = null,
): EbayPolicyOption | null {
  if (policies.length === 0) return null;

  const aliMin = aliExpressMinDays ?? aliExpressMaxDays;
  const aliMax = aliExpressMaxDays ?? aliExpressMinDays;
  if (aliMin == null || aliMax == null) return policies[0];

  const parsed = policies
    .map((policy) => {
      const days = parseDeliveryDaysFromText(policyDeliveryText(policy));
      if (!days) return null;
      return { policy, days };
    })
    .filter((entry): entry is { policy: EbayPolicyOption; days: ParsedDeliveryDays } => entry !== null);

  if (parsed.length === 0) return null;

  const ranked = parsed
    .map((entry) => ({
      ...entry,
      score: scorePolicyMatch(entry.days, aliMin, aliMax),
    }))
    .sort((a, b) => a.score - b.score || a.days.maxDays - b.days.maxDays);

  return ranked[0]?.policy ?? null;
}
