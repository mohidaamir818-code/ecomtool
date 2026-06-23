import "server-only";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-GB,en;q=0.9",
};

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
  "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";

type ShippingDaysResult = { minDays: number; maxDays: number; label: string };

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

export function formatAmazefShippingDays(minDays: number, maxDays: number): string {
  const low = Math.min(minDays, maxDays);
  const high = Math.max(minDays, maxDays);
  if (low === high) return `${low} days`;
  return `${low} to ${high} days`;
}

function toResult(minDays: number, maxDays: number): ShippingDaysResult {
  return {
    minDays,
    maxDays,
    label: formatAmazefShippingDays(minDays, maxDays),
  };
}

export function calculateShippingDaysFromDeliveryDates(
  startDate: Date,
  endDate: Date,
  referenceDate = new Date(),
): ShippingDaysResult {
  const minDays = daysUntil(referenceDate, startDate);
  const maxDays = daysUntil(referenceDate, endDate);
  return toResult(minDays, maxDays);
}

/** AliExpress sometimes already shows "7-15 days" or "12 days". */
function parseDirectDayCount(text: string): ShippingDaysResult | null {
  const normalized = text.replace(/\s+/g, " ").trim();

  const rangeMatch = normalized.match(
    /\b(\d{1,3})\s*(?:-|–|~|to)\s*(\d{1,3})\s*(?:business\s+)?days?\b/i,
  );
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (min > 0 && max > 0 && min <= 120 && max <= 120) {
      return toResult(min, max);
    }
  }

  const singleMatch = normalized.match(/\b(\d{1,3})\s*(?:business\s+)?days?\b/i);
  if (singleMatch) {
    const days = Number(singleMatch[1]);
    if (days > 0 && days <= 120) {
      return toResult(days, days);
    }
  }

  return null;
}

function parseDateRangeFromMatch(
  monthA: number,
  dayA: number,
  monthB: number,
  dayB: number,
  referenceDate: Date,
): ShippingDaysResult | null {
  if (dayA < 1 || dayA > 31 || dayB < 1 || dayB > 31) return null;

  const startDate = resolveDeliveryDate(monthA, dayA, referenceDate);
  const endDate = resolveDeliveryDate(monthB, dayB, referenceDate);
  return calculateShippingDaysFromDeliveryDates(startDate, endDate, referenceDate);
}

function parseCalendarDateRange(
  text: string,
  referenceDate = new Date(),
): ShippingDaysResult | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const patterns: Array<{
    regex: RegExp;
    resolve: (match: RegExpMatchArray) => ShippingDaysResult | null;
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
        return parseDateRangeFromMatch(monthA, dayA, monthB, dayB, referenceDate);
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
        return parseDateRangeFromMatch(monthA, dayA, monthB, dayB, referenceDate);
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
        return parseDateRangeFromMatch(monthA, dayA, monthA, dayB, referenceDate);
      },
    },
    {
      regex:
        /\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\s*(?:-|–|~|to)\s*(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/,
      resolve: (match) => {
        const monthA = Number(match[2]) - 1;
        const dayA = Number(match[1]);
        const monthB = Number(match[5]) - 1;
        const dayB = Number(match[4]);
        if (monthA < 0 || monthA > 11 || monthB < 0 || monthB > 11) return null;
        return parseDateRangeFromMatch(monthA, dayA, monthB, dayB, referenceDate);
      },
    },
  ];

  for (const { regex, resolve } of patterns) {
    const match = normalized.match(regex);
    if (!match) continue;
    const result = resolve(match);
    if (result) return result;
  }

  return null;
}

function parseJsonDayFields(html: string): ShippingDaysResult | null {
  const minMaxPatterns = [
    /"(?:min|minimum)(?:Delivery|Shipping)?Days?"\s*:\s*"?(\d{1,3})"?/i,
    /"(?:max|maximum)(?:Delivery|Shipping)?Days?"\s*:\s*"?(\d{1,3})"?/i,
    /"deliveryDays(?:Min|From)?"\s*:\s*"?(\d{1,3})"?/i,
    /"deliveryDays(?:Max|To)?"\s*:\s*"?(\d{1,3})"?/i,
  ];

  const mins: number[] = [];
  const maxs: number[] = [];

  for (const pattern of minMaxPatterns) {
    const matches = [...html.matchAll(new RegExp(pattern.source, "gi"))];
    for (const match of matches) {
      const value = Number(match[1]);
      if (!Number.isFinite(value) || value <= 0 || value > 120) continue;
      if (/min|from/i.test(match[0])) mins.push(value);
      else maxs.push(value);
    }
  }

  const rangeInJson = html.match(
    /"deliveryDays"\s*:\s*"(\d{1,3})\s*(?:-|–|~|to)\s*(\d{1,3})"/i,
  );
  if (rangeInJson) {
    return toResult(Number(rangeInJson[1]), Number(rangeInJson[2]));
  }

  if (mins.length && maxs.length) {
    return toResult(Math.min(...mins), Math.max(...maxs));
  }
  if (mins.length === 1 && maxs.length === 0) {
    return toResult(mins[0], mins[0]);
  }

  return null;
}

function collectDeliverySnippets(html: string): string[] {
  const snippets = new Set<string>();

  const jsonPatterns = [
    /"deliveryDate(?:Display)?"\s*:\s*"([^"]{2,120})"/gi,
    /"shippingTime(?:Display)?"\s*:\s*"([^"]{2,120})"/gi,
    /"deliveryTime(?:Display)?"\s*:\s*"([^"]{2,120})"/gi,
    /"logisticsDesc(?:ription)?"\s*:\s*"([^"]{2,120})"/gi,
    /"shippingInfo(?:Text)?"\s*:\s*"([^"]{2,120})"/gi,
    /"arriveTime(?:Text)?"\s*:\s*"([^"]{2,120})"/gi,
    /"time"\s*:\s*"([^"]{2,120})"/gi,
  ];

  for (const pattern of jsonPatterns) {
    for (const match of html.matchAll(pattern)) {
      const value = match[1]?.replace(/\\u0026/g, "&").replace(/\\"/g, '"').trim();
      if (value) snippets.add(value);
    }
  }

  const visiblePatterns = [
    /Estimated delivery[^<]{0,60}?([A-Za-z]{3,9}\s+\d{1,2}[^<]{0,40})/gi,
    /Delivery(?:\s+by)?[^<]{0,30}?([A-Za-z]{3,9}\s+\d{1,2}[^<]{0,40})/gi,
    /\b(\d{1,3}\s*(?:-|–|~|to)\s*\d{1,3}\s*(?:business\s+)?days?)\b/gi,
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\s*(?:-|–|~|to)\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+)?\d{1,2})\b/gi,
    /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(?:-|–|~|to)\s*\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\b/gi,
  ];

  for (const pattern of visiblePatterns) {
    for (const match of html.matchAll(pattern)) {
      const value = match[1]?.trim();
      if (value) snippets.add(value);
    }
  }

  return [...snippets];
}

export function parseAliExpressShippingDays(
  htmlOrText: string,
  referenceDate = new Date(),
): ShippingDaysResult | null {
  const jsonDays = parseJsonDayFields(htmlOrText);
  if (jsonDays) return jsonDays;

  const candidates = collectDeliverySnippets(htmlOrText);
  if (!candidates.includes(htmlOrText)) {
    candidates.unshift(htmlOrText);
  }

  for (const candidate of candidates) {
    const direct = parseDirectDayCount(candidate);
    if (direct) return direct;

    const calendar = parseCalendarDateRange(candidate, referenceDate);
    if (calendar) return calendar;
  }

  return null;
}

export async function fetchAliExpressShippingDaysLabel(
  productUrl: string,
): Promise<string | null> {
  try {
    const response = await fetch(productUrl, {
      headers: BROWSER_HEADERS,
      cache: "no-store",
    });

    if (!response.ok) return null;

    const html = await response.text();
    const parsed = parseAliExpressShippingDays(html);
    return parsed?.label ?? null;
  } catch {
    return null;
  }
}
