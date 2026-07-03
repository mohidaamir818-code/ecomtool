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

const ALI_END_BUFFER_MIN_DAYS = 1;
const ALI_END_BUFFER_MAX_DAYS = 2;

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

function toDeliveryDays(
  startDate: Date,
  endDate: Date,
  referenceDate: Date,
): ParsedDeliveryDays {
  return {
    minDays: daysUntil(referenceDate, startDate),
    maxDays: daysUntil(referenceDate, endDate),
  };
}

function calendarRangeFromMatch(
  match: RegExpMatchArray,
  patternIndex: number,
  referenceDate: Date,
): ParsedDeliveryDays | null {
  switch (patternIndex) {
    case 0: {
      const monthA = parseMonthName(match[1]);
      const dayA = Number(match[2]);
      const monthB = parseMonthName(match[3] ?? match[1]);
      const dayB = Number(match[4]);
      if (monthA == null || monthB == null) return null;
      return toDeliveryDays(
        resolveDeliveryDate(monthA, dayA, referenceDate),
        resolveDeliveryDate(monthB, dayB, referenceDate),
        referenceDate,
      );
    }
    case 1: {
      const dayA = Number(match[1]);
      const dayB = Number(match[2]);
      const month = parseMonthName(match[3]);
      if (month == null) return null;
      return toDeliveryDays(
        resolveDeliveryDate(month, dayA, referenceDate),
        resolveDeliveryDate(month, dayB, referenceDate),
        referenceDate,
      );
    }
    case 2: {
      const dayA = Number(match[1]);
      const dayB = Number(match[2]);
      const month = parseMonthName(match[3]);
      if (month == null) return null;
      return toDeliveryDays(
        resolveDeliveryDate(month, dayA, referenceDate),
        resolveDeliveryDate(month, dayB, referenceDate),
        referenceDate,
      );
    }
    case 3: {
      const monthA = parseMonthName(match[2]);
      const dayA = Number(match[1]);
      const monthB = parseMonthName(match[4]);
      const dayB = Number(match[3]);
      if (monthA == null || monthB == null) return null;
      return toDeliveryDays(
        resolveDeliveryDate(monthA, dayA, referenceDate),
        resolveDeliveryDate(monthB, dayB, referenceDate),
        referenceDate,
      );
    }
    case 4: {
      const month = parseMonthName(match[2]);
      const dayA = Number(match[1]);
      const dayB = Number(match[3]);
      if (month == null) return null;
      return toDeliveryDays(
        resolveDeliveryDate(month, dayA, referenceDate),
        resolveDeliveryDate(month, dayB, referenceDate),
        referenceDate,
      );
    }
    default:
      return null;
  }
}

const CALENDAR_PATTERNS: RegExp[] = [
  new RegExp(
    `\\b(${MONTH_PATTERN})\\s+(\\d{1,2})\\s*(?:-|–|~|to)\\s*(?:(${MONTH_PATTERN})\\s+)?(\\d{1,2})\\b`,
    "gi",
  ),
  new RegExp(`\\b(\\d{1,2})\\s*(?:to|-|–|~)\\s*(\\d{1,2})\\s+(${MONTH_PATTERN})\\b`, "gi"),
  new RegExp(`\\b(\\d{1,2})-(\\d{1,2})\\s+(${MONTH_PATTERN})\\b`, "gi"),
  new RegExp(
    `\\b(\\d{1,2})\\s+(${MONTH_PATTERN})\\s*(?:-|–|~|to)\\s*(\\d{1,2})\\s+(${MONTH_PATTERN})\\b`,
    "gi",
  ),
  new RegExp(
    `\\b(\\d{1,2})\\s+(${MONTH_PATTERN})\\s*(?:-|–|~|to)\\s*(\\d{1,2})\\b`,
    "gi",
  ),
];

function parseAllCalendarDateRanges(
  text: string,
  referenceDate = new Date(),
): ParsedDeliveryDays[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const results: ParsedDeliveryDays[] = [];
  const seen = new Set<string>();

  CALENDAR_PATTERNS.forEach((regex, patternIndex) => {
    regex.lastIndex = 0;
    for (const match of normalized.matchAll(regex)) {
      const parsed = calendarRangeFromMatch(match, patternIndex, referenceDate);
      if (!parsed || parsed.maxDays > 90) continue;
      const key = `${parsed.minDays}-${parsed.maxDays}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(parsed);
    }
  });

  return results;
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

/** handling time + longest shipping-service transit from policy details. */
function parseHandlingPlusShippingDays(text: string): ParsedDeliveryDays | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  let handling = 0;
  const handlingMatch = normalized.match(/handling\s+(\d+)/i);
  if (handlingMatch) handling = Number(handlingMatch[1]);

  let shipMin = 0;
  let shipMax = 0;

  for (const match of normalized.matchAll(/(\d+)\s*-\s*(\d+)\s*(?:business\s*)?(?:day|days)/gi)) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (!Number.isFinite(first) || !Number.isFinite(second) || second > 60) continue;
    shipMin = shipMin === 0 ? Math.min(first, second) : Math.min(shipMin, Math.min(first, second));
    shipMax = Math.max(shipMax, Math.max(first, second));
  }

  if (shipMax > 0) {
    return {
      minDays: handling + shipMin,
      maxDays: handling + shipMax,
    };
  }

  for (const match of normalized.matchAll(/(\d+)\s*(?:business\s*)?(?:day|days)/gi)) {
    const days = Number(match[1]);
    if (!Number.isFinite(days) || days > 60) continue;
    if (handlingMatch && match.index != null && match.index === handlingMatch.index) continue;
    shipMax = Math.max(shipMax, days);
    shipMin = shipMin === 0 ? days : Math.min(shipMin, days);
  }

  if (shipMax > 0) {
    return {
      minDays: handling + shipMin,
      maxDays: handling + shipMax,
    };
  }

  return handling > 0 ? { minDays: handling, maxDays: handling } : null;
}

export function parseDeliveryDaysFromText(
  text: string,
  referenceDate = new Date(),
): ParsedDeliveryDays | null {
  const calendars = parseAllCalendarDateRanges(text, referenceDate);
  if (calendars.length > 0) return calendars[0];
  return parseExplicitDayCount(text) ?? parseHandlingPlusShippingDays(text);
}

/** Policy name is ignored — only internal handling/shipping/calendar details. */
function extractPolicyDeliveryWindow(
  policy: EbayPolicyOption,
  referenceDate: Date,
): ParsedDeliveryDays | null {
  const description = (policy.description ?? "").replace(/\s+/g, " ").trim();
  if (!description) return null;

  const handlingShipping = parseHandlingPlusShippingDays(description);
  const calendars = parseAllCalendarDateRanges(description, referenceDate);

  if (handlingShipping && calendars.length > 0) {
    const calendarMax = Math.max(...calendars.map((entry) => entry.maxDays));
    if (calendarMax > handlingShipping.maxDays) {
      const bestCalendar = calendars.sort((a, b) => a.maxDays - b.maxDays)[0];
      return bestCalendar;
    }
    return handlingShipping;
  }

  if (handlingShipping) return handlingShipping;
  if (calendars.length > 0) {
    return calendars.sort((a, b) => a.maxDays - b.maxDays)[0];
  }

  return null;
}

function scorePolicyWindow(
  policyDays: ParsedDeliveryDays,
  aliMin: number,
  aliMax: number,
): number {
  const startLow = aliMin;
  const startHigh = aliMin + ALI_END_BUFFER_MAX_DAYS;
  const endLow = aliMax + ALI_END_BUFFER_MIN_DAYS;
  const endHigh = aliMax + ALI_END_BUFFER_MAX_DAYS;

  let score = 0;

  if (policyDays.minDays >= startLow && policyDays.minDays <= startHigh) {
    score += policyDays.minDays - startLow;
  } else if (policyDays.minDays < startLow) {
    score += (startLow - policyDays.minDays) * 15 + 50;
  } else {
    score += (policyDays.minDays - startHigh) * 10 + 20;
  }

  if (policyDays.maxDays >= endLow && policyDays.maxDays <= endHigh) {
    score += policyDays.maxDays - endLow;
  } else if (policyDays.maxDays < aliMax) {
    score += (aliMax - policyDays.maxDays) * 10 + 30;
  } else if (policyDays.maxDays > endHigh) {
    score += (policyDays.maxDays - endHigh) * 12 + 20;
  } else {
    score += endLow - policyDays.maxDays + 10;
  }

  return score;
}

/**
 * Pick the fulfillment policy using only its internal delivery calculation.
 * Start ≈ Ali start (+0–2 days). End ≈ Ali end (+1–2 days).
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

  const referenceDate = new Date();
  const ranked: Array<{ policy: EbayPolicyOption; days: ParsedDeliveryDays; score: number }> = [];

  for (const policy of policies) {
    const days = extractPolicyDeliveryWindow(policy, referenceDate);
    if (!days) continue;
    ranked.push({
      policy,
      days,
      score: scorePolicyWindow(days, aliMin, aliMax),
    });
  }

  if (ranked.length === 0) return null;

  ranked.sort(
    (a, b) =>
      a.score - b.score ||
      Math.abs(a.days.minDays - aliMin) - Math.abs(b.days.minDays - aliMin) ||
      Math.abs(a.days.maxDays - aliMax) - Math.abs(b.days.maxDays - aliMax),
  );

  return ranked[0].policy;
}
