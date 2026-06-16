import assert from "node:assert/strict";

const testUrl =
  "https://www.aliexpress.com/item/1005010230088708.html?pdp_npi=6%40dis%21GBP%215.19%212.18%21%21%2145.73%2119.22";

function parseNumber(value) {
  if (value == null) return null;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractPriceHintFromUrl(url) {
  const npi = new URL(url).searchParams.get("pdp_npi");
  if (!npi) return null;
  const parts = decodeURIComponent(npi).split("!");
  const currencyIndex = parts.findIndex((part) => /^[A-Z]{3}$/.test(part));
  if (currencyIndex < 0 || currencyIndex + 2 >= parts.length) return null;
  const currency = parts[currencyIndex];
  const original = parseNumber(parts[currencyIndex + 1]);
  const sale = parseNumber(parts[currencyIndex + 2]);
  if (sale == null) return null;
  return { price: sale, currency, original: original ?? undefined };
}

function pickDisplayPriceFromCandidates(candidates) {
  const unique = [...new Set(candidates)].sort((a, b) => b - a);
  if (unique.length === 1) return unique[0];
  const highest = unique[0];
  const secondHighest = unique[1];
  if (highest >= secondHighest * 1.4) {
    const plausible = unique.filter((price) => price >= highest * 0.45);
    return Math.max(...plausible);
  }
  return highest;
}

const hint = extractPriceHintFromUrl(testUrl);
assert.equal(hint?.price, 2.18, "URL hint should parse sale price 2.18");
assert.equal(hint?.currency, "GBP");

const picked = pickDisplayPriceFromCandidates([0.99, 2.07, 2.18]);
assert.equal(picked, 2.18, "should drop 0.99 coupon outlier");

const limitBlob = JSON.stringify({ maxBuyCount: 1, maxBuyCountStr: "Max. 10 pcs/shopper" });
const match = [...limitBlob.matchAll(/Max\.?\s*(\d+)\s*pcs/gi)][0];
assert.equal(Number(match[1]), 10);

console.log("All tests passed.");
