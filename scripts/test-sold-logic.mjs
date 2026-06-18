function parseNumber(value) {
  if (value == null) return null;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractOrderHintFromUrl(url) {
  try {
    const raw = new URL(url).searchParams.get("pdp_ext_f");
    if (!raw) return null;
    const payload = JSON.parse(decodeURIComponent(raw));
    return parseNumber(payload.order);
  } catch {
    return null;
  }
}

function parseSoldCountDisplay(value) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const soldMatch = normalized.match(/^([\d,]+)\s*sold\b/i);
  if (soldMatch) return parseNumber(soldMatch[1]);
  return parseNumber(normalized);
}

function resolve(apiOrders, urls) {
  const candidates = [];
  const fromOrders = parseSoldCountDisplay(apiOrders);
  if (fromOrders != null) candidates.push(fromOrders);
  for (const url of urls) {
    const hint = extractOrderHintFromUrl(url);
    if (hint != null) candidates.push(hint);
  }
  return `${Math.max(...candidates).toLocaleString("en-US")} sold`;
}

const url =
  "https://www.aliexpress.com/item/1005011923896571.html?pdp_ext_f=%7B%22order%22%3A%2214%22%2C%22fromPage%22%3A%22search%22%7D";
console.log("hint", extractOrderHintFromUrl(url));
console.log("resolved", resolve("13 sold", [url]));
