// Unit tests for parsing logic (no live API needed)
import assert from "node:assert/strict";

function parseNumber(value) {
  if (value == null) return null;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSalePriceLocal(value) {
  if (!value) return null;
  const leading = value.split("|")[0];
  const fromLeading = parseNumber(leading);
  if (fromLeading != null) return fromLeading;
  const parts = value.split("|");
  if (parts.length >= 3) {
    const whole = parseNumber(parts[1]);
    const fraction = parts[2];
    if (whole != null && fraction) return parseNumber(`${whole}.${fraction.padStart(2, "0")}`);
  }
  return null;
}

function parseSkuPriceEntry(entry) {
  const currency = entry.originalPrice?.currency ?? "GBP";
  const shelfPrice =
    parseSalePriceLocal(entry.salePriceLocal) ?? parseNumber(entry.salePriceString);
  if (shelfPrice != null) return { price: shelfPrice, currency };
  return null;
}

function parseLimitFromNote(note) {
  if (!note) return null;
  const maxPerShopper = note.match(/Max\.?\s*(\d+)\s*pcs/i);
  if (maxPerShopper) return Number(maxPerShopper[1]);
  const onlyLeft = note.match(/Only\s+(\d+)\s+left/i);
  if (onlyLeft) return Number(onlyLeft[1]);
  return null;
}

// Vacuum product: API may return coupon price in salePriceString but display price in salePriceLocal
const vacuumPrice = parseSkuPriceEntry({
  salePriceString: "￡3.74",
  salePriceLocal: "￡5.08|5|08",
  originalPrice: { value: 10.62, currency: "GBP" },
});
assert.equal(vacuumPrice.price, 5.08, "price should be 5.08 not 3.74");

// Higher of two SKU price maps
const primary = parseSkuPriceEntry({ salePriceString: "￡3.74" });
const second = parseSkuPriceEntry({ salePriceString: "￡5.08" });
const picked = primary.price >= second.price ? primary : second;
assert.equal(picked.price, 5.08, "should pick higher shelf price");

// Max qty from shopper limit text
assert.equal(parseLimitFromNote("Max. 10 pcs/shopper"), 10);
assert.equal(parseLimitFromNote("Only 8 left"), 8);

console.log("All parsing tests passed.");
