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

/**
 * Build eBay search queries for competitor watches.
 * eBay treats space-separated words as AND, so long pasted titles often return zero results.
 * Returns candidates from more specific to broader keyword sets.
 */
export function buildEbayCompetitorSearchQueries(raw: string): string[] {
  const cleaned = raw.trim().replace(/\s+/g, " ");
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
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return [];

  const significant = extractSignificantTokens(cleaned);
  const sixWord = significant.slice(0, 6).join(" ");
  const all = buildEbayCompetitorSearchQueries(raw);

  return dedupeQueries([
    sixWord,
    ...all.filter((query) => query !== cleaned && query !== sixWord),
  ]);
}

/**
 * Returns true when the eBay listing title contains every significant token
 * from the user's original product query.
 */
export function ebayListingMatchesProductQuery(
  listingTitle: string,
  productQuery: string,
): boolean {
  const requiredTokens = extractSignificantTokens(productQuery);
  if (requiredTokens.length === 0) return true;

  const listingNorm = listingTitle.toLowerCase();

  return requiredTokens.every((token) => listingNorm.includes(token.toLowerCase()));
}
