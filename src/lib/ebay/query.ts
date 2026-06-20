const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "with",
  "from",
  "by",
  "to",
  "of",
  "your",
  "new",
  "hot",
  "sale",
  "free",
  "shipping",
]);

const JUNK_SUFFIXES = /(?:view|details|description)$/i;

const EBAY_NOISE_SUFFIXES = [
  /\s+free\s+postage\s*$/i,
  /\s+free\s+p&p\s*$/i,
  /\s+brand\s+new\s*$/i,
];

function normalizeToken(token: string): string {
  return token.replace(/[^\w'-]/g, "").trim();
}

function isNumericToken(token: string): boolean {
  return /^\d+$/.test(token);
}

function shouldKeepToken(token: string, prev: string | null, next: string | null): boolean {
  const lower = token.toLowerCase();

  if (isNumericToken(token)) return true;

  if (lower === "in" && isNumericToken(prev ?? "") && isNumericToken(next ?? "")) {
    return true;
  }

  if (STOP_WORDS.has(lower)) return false;

  if (token.length < 2) return false;

  if (JUNK_SUFFIXES.test(token)) return false;

  return true;
}

function extractSignificantTokens(raw: string): string[] {
  const tokens = raw
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map(normalizeToken)
    .filter(Boolean);

  const significant: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const prev = index > 0 ? tokens[index - 1] : null;
    const next = index < tokens.length - 1 ? tokens[index + 1] : null;

    if (shouldKeepToken(token, prev, next)) {
      significant.push(token);
    }
  }

  return significant;
}

function dedupeQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const query of queries) {
    const key = query.toLowerCase();
    if (!query || seen.has(key)) continue;
    seen.add(key);
    result.push(query);
  }

  return result;
}

/** Strip UI junk from pasted seller titles before search or comparison. */
export function cleanCompetitorProductQuery(raw: string): string {
  let title = raw.trim().replace(/\s+/g, " ");
  title = title.replace(/(\w+?)(View|Details|Description)\s*$/i, "$1");
  title = title.replace(/\s+\b(?:view|details|description)\s*$/i, "");
  return title.trim();
}

/** Normalize a title for same-title comparison (preserves product words like Hot, With, Grey). */
export function normalizeTitleForComparison(title: string): string {
  let normalized = cleanCompetitorProductQuery(title)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const pattern of EBAY_NOISE_SUFFIXES) {
    normalized = normalized.replace(pattern, "").trim();
  }

  return normalized;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0),
  );

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

function isContainedTitleMatch(a: string, b: string): boolean {
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length === 0) return false;
  if (!longer.includes(shorter)) return false;
  return shorter.length / longer.length >= 0.8;
}

/**
 * Returns true when the eBay listing title is the same product title the seller provided.
 * Uses normalized exact match, contained match, or high similarity — not broad keyword overlap.
 */
export function ebayListingMatchesSameTitle(listingTitle: string, sellerTitle: string): boolean {
  const listingNorm = normalizeTitleForComparison(listingTitle);
  const sellerNorm = normalizeTitleForComparison(sellerTitle);

  if (!listingNorm || !sellerNorm) return false;
  if (listingNorm === sellerNorm) return true;
  if (isContainedTitleMatch(listingNorm, sellerNorm)) return true;
  return levenshteinSimilarity(listingNorm, sellerNorm) >= 0.9;
}

/**
 * Build eBay search queries for competitor watches.
 * eBay treats space-separated words as AND, so long pasted titles often return zero results.
 * Returns candidates from more specific to broader keyword sets.
 */
export function buildEbayCompetitorSearchQueries(raw: string): string[] {
  const cleaned = cleanCompetitorProductQuery(raw);
  if (!cleaned) return [];

  const significant = extractSignificantTokens(cleaned);
  const rawWords = cleaned.split(" ").map(normalizeToken).filter(Boolean);

  const candidates = dedupeQueries([
    cleaned,
    significant.slice(0, 8).join(" "),
    significant.slice(0, 6).join(" "),
    significant.slice(0, 4).join(" "),
    rawWords.slice(0, 6).join(" "),
    significant.slice(0, 3).join(" "),
  ]);

  return candidates.length > 0 ? candidates : [cleaned];
}

/**
 * Optimized query order for competitor watches: skip full pasted title, try 6 keywords first.
 */
export function buildEbayCompetitorWatchSearchQueries(raw: string): string[] {
  const cleaned = cleanCompetitorProductQuery(raw);
  if (!cleaned) return [];

  const significant = extractSignificantTokens(cleaned);
  const sixWord = significant.slice(0, 6).join(" ");
  const all = buildEbayCompetitorSearchQueries(cleaned);

  return dedupeQueries([
    sixWord,
    ...all.filter((query) => query !== cleaned && query !== sixWord),
  ]);
}

/** Single eBay search query used for competitor watches (one API call per check). */
export function getEbayCompetitorWatchSearchQuery(raw: string): string {
  const queries = buildEbayCompetitorWatchSearchQueries(raw);
  return queries[0] ?? cleanCompetitorProductQuery(raw);
}

/**
 * @deprecated Use ebayListingMatchesSameTitle for competitor checks.
 */
export function ebayListingMatchesProductQuery(
  listingTitle: string,
  productQuery: string,
): boolean {
  return ebayListingMatchesSameTitle(listingTitle, productQuery);
}
