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

export function calculateShippingDaysFromDeliveryDates(
  startDate: Date,
  endDate: Date,
  referenceDate = new Date(),
): { minDays: number; maxDays: number; label: string } {
  const minDays = daysUntil(referenceDate, startDate);
  const maxDays = daysUntil(referenceDate, endDate);
  return {
    minDays,
    maxDays,
    label: formatAmazefShippingDays(minDays, maxDays),
  };
}

function parseDeliveryRangeText(
  text: string,
  referenceDate = new Date(),
): { minDays: number; maxDays: number; label: string } | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const patterns = [
    new RegExp(
      `\\b(${MONTH_PATTERN})\\s+(\\d{1,2})\\s*(?:-|–|to)\\s*(?:(${MONTH_PATTERN})\\s+)?(\\d{1,2})\\b`,
      "i",
    ),
    new RegExp(
      `\\b(\\d{1,2})\\s+(${MONTH_PATTERN})\\s*(?:-|–|to)\\s*(?:\\d{1,2}\\s+)?(?:(${MONTH_PATTERN})\\s+)?(\\d{1,2})\\b`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    const isDayFirst = /^\d/.test(match[1]);
    const monthA = parseMonthName(isDayFirst ? match[2] : match[1]);
    const dayA = Number(isDayFirst ? match[1] : match[2]);
    const monthB = parseMonthName(isDayFirst ? (match[3] ?? match[2]) : (match[3] ?? match[1]));
    const dayB = Number(isDayFirst ? match[4] : match[4]);

    if (monthA == null || monthB == null || !Number.isFinite(dayA) || !Number.isFinite(dayB)) {
      continue;
    }

    const startDate = resolveDeliveryDate(monthA, dayA, referenceDate);
    const endDate = resolveDeliveryDate(monthB, dayB, referenceDate);
    return calculateShippingDaysFromDeliveryDates(startDate, endDate, referenceDate);
  }

  return null;
}

function extractDeliveryTextFromHtml(html: string): string | null {
  const jsonPatterns = [
    /"deliveryDate(?:Display)?"\s*:\s*"([^"]{3,80})"/i,
    /"shippingTime(?:Display)?"\s*:\s*"([^"]{3,80})"/i,
    /"deliveryTime(?:Display)?"\s*:\s*"([^"]{3,80})"/i,
    /"time"\s*:\s*"([^"]*\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^"]{0,40})"/i,
  ];

  for (const pattern of jsonPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].replace(/\\u0026/g, "&");
  }

  const visiblePatterns = [
    /Estimated delivery[^<]{0,40}?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^<]{0,40})/i,
    /Delivery[^<]{0,20}?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s*(?:-|–|to)\s*\d{1,2})/i,
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\s*(?:-|–|to)\s*\d{1,2})\b/i,
  ];

  for (const pattern of visiblePatterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function parseAliExpressShippingDays(
  htmlOrText: string,
  referenceDate = new Date(),
): { minDays: number; maxDays: number; label: string } | null {
  const deliveryText = extractDeliveryTextFromHtml(htmlOrText) ?? htmlOrText;
  return parseDeliveryRangeText(deliveryText, referenceDate);
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
