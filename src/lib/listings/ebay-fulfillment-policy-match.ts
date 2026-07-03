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

function extractPolicyDeliveryWindows(
  policy: EbayPolicyOption,
  referenceDate: Date,
): ParsedDeliveryDays[] {
  const name = policy.name.replace(/\s+/g, " ").trim();
  const description = (policy.description ?? "").replace(/\s+/g, " ").trim();
  const windows: ParsedDeliveryDays[] = [];

  const nameCalendars = parseAllCalendarDateRanges(name, referenceDate);
  if (nameCalendars.length > 0) {
    return nameCalendars;
  }

  const nameDays = parseExplicitDayCount(name);
  if (nameDays) windows.push(nameDays);

  const descCalendars = parseAllCalendarDateRanges(description, referenceDate);
  windows.push(...descCalendars);

  const handlingShipping = parseHandlingPlusShippingDays(description);
  if (handlingShipping) windows.push(handlingShipping);

  const descDays = parseExplicitDayCount(description);
  if (descDays) windows.push(descDays);

  const seen = new Set<string>();
  return windows.filter((window) => {
    const key = `${window.minDays}-${window.maxDays}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Pick the fulfillment policy whose delivery end is on or after AliExpress,
 * choosing the tightest fit (smallest end date / max days still >= Ali max).
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
  const qualifying: Array<{ policy: EbayPolicyOption; days: ParsedDeliveryDays }> = [];
  const allParsed: Array<{ policy: EbayPolicyOption; days: ParsedDeliveryDays }> = [];

  for (const policy of policies) {
    const windows = extractPolicyDeliveryWindows(policy, referenceDate);
    for (const days of windows) {
      allParsed.push({ policy, days });
      if (days.maxDays >= aliMax) {
        qualifying.push({ policy, days });
      }
    }
  }

  if (qualifying.length > 0) {
    qualifying.sort(
      (a, b) =>
        a.days.maxDays - b.days.maxDays ||
        a.days.minDays - b.days.minDays ||
        a.policy.name.localeCompare(b.policy.name),
    );
    return qualifying[0].policy;
  }

  if (allParsed.length > 0) {
    allParsed.sort(
      (a, b) =>
        b.days.maxDays - a.days.maxDays ||
        b.days.minDays - a.days.minDays,
    );
    return allParsed[0].policy;
  }

  return null;
}
