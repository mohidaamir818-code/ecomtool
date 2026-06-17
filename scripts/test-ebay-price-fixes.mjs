/**
 * Verifies eBay price range, shipping, and variation handling.
 * Run: node scripts/test-ebay-price-fixes.mjs
 *
 * Requires EBAY_APP_ID and EBAY_CERT_ID in .env.local
 */
import { loadEnv, requireEnv } from "./load-env.mjs";

loadEnv();

const appId = requireEnv("EBAY_APP_ID");
const certId = requireEnv("EBAY_CERT_ID");
const auth = Buffer.from(`${appId}:${certId}`).toString("base64");
const MARKETPLACE_ID = "EBAY_GB";

function formatPrice(price, currency) {
  if (currency === "GBP") return `£${price.toFixed(2)}`;
  return `${currency} ${price.toFixed(2)}`;
}

function formatPriceRange(min, max, currency) {
  if (min === max) return formatPrice(min, currency);
  return `${formatPrice(min, currency)} – ${formatPrice(max, currency)}`;
}

function resolveMinShipping(shippingOptions, fallbackCurrency) {
  if (!shippingOptions?.length) {
    return { minCost: null, multipleTiers: false, label: "—" };
  }
  const parsed = shippingOptions
    .map((o) => {
      if (o.shippingCost?.value === undefined) return null;
      const value = parseFloat(o.shippingCost.value);
      if (!Number.isFinite(value)) return null;
      return { value, currency: o.shippingCost.currency ?? fallbackCurrency };
    })
    .filter(Boolean);

  if (!parsed.length) return { minCost: null, multipleTiers: false, label: "—" };

  const minEntry = parsed.reduce((a, b) => (b.value < a.value ? b : a));
  const multipleTiers = parsed.length > 1 && new Set(parsed.map((p) => p.value)).size > 1;

  let label;
  if (multipleTiers) {
    label = minEntry.value === 0 ? "from Free" : `from ${formatPrice(minEntry.value, minEntry.currency)}`;
  } else if (minEntry.value === 0) {
    label = "Free";
  } else {
    label = formatPrice(minEntry.value, minEntry.currency);
  }

  return { minCost: minEntry.value, multipleTiers, label };
}

async function fetchVariationRange(token, href) {
  const r = await fetch(href, {
    headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE_ID },
  });
  if (!r.ok) return null;
  const data = await r.json();
  const prices = (data.items ?? [])
    .map((i) => parseFloat(i.price?.value ?? "0"))
    .filter((p) => p > 0);
  if (!prices.length) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

async function main() {
  const tokenRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
  });
  const { access_token: token } = await tokenRes.json();
  const headers = { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE_ID };

  const searchRes = await fetch(
    "https://api.ebay.com/buy/browse/v1/item_summary/search?q=wireless+earbuds&limit=10&offset=0&sort=price",
    { headers },
  );
  const searchData = await searchRes.json();

  console.log("=== wireless earbuds — first 10 results (price fix verification) ===\n");

  for (const item of searchData.itemSummaries) {
    const hasVariations = item.itemGroupType === "SELLER_DEFINED_VARIATIONS";
    const shipping = resolveMinShipping(item.shippingOptions, item.price?.currency ?? "GBP");

    let priceMin = parseFloat(item.price?.value ?? "0");
    let priceMax = priceMin;
    if (hasVariations && item.itemGroupHref) {
      const range = await fetchVariationRange(token, item.itemGroupHref);
      if (range) {
        priceMin = range.min;
        priceMax = range.max;
      }
    }

    const currency = item.price?.currency ?? "GBP";
    const minShip = shipping.minCost ?? 0;
    const priceLabel =
      hasVariations && priceMin !== priceMax
        ? formatPriceRange(priceMin, priceMax, currency)
        : formatPrice(priceMin, currency);
    const totalLabel =
      hasVariations && priceMin !== priceMax
        ? formatPriceRange(priceMin + minShip, priceMax + minShip, currency)
        : shipping.multipleTiers
          ? `from ${formatPrice(priceMin + minShip, currency)}`
          : formatPrice(priceMin + minShip, currency);

    console.log(`Seller: ${item.seller?.username}`);
    console.log(`Title: ${item.title?.slice(0, 60)}...`);
    console.log(`Variations badge: ${hasVariations ? "YES" : "no"}`);
    console.log(`Old API min-only price: ${formatPrice(parseFloat(item.price?.value), currency)}`);
    console.log(`New price range:       ${priceLabel}`);
    console.log(`Shipping:              ${shipping.label} (${item.shippingOptions?.length ?? 0} tiers)`);
    console.log(`Total:                 ${totalLabel}`);
    console.log(`URL: ${item.itemWebUrl}`);
    console.log("---");
  }

  const known = searchData.itemSummaries.find((i) => i.legacyItemId === "127815668365");
  if (known) {
    const range = await fetchVariationRange(token, known.itemGroupHref);
    console.log("\n=== SPOT CHECK: item 127815668365 ===");
    console.log(`Expected price range: £${range?.min.toFixed(2)} – £${range?.max.toFixed(2)}`);
    console.log("(Previously showed only £0.99 — the cheapest sim-pin variant)");
  }

  const lupo = await fetch(
    "https://api.ebay.com/buy/browse/v1/item/v1%7C306176878569%7C605688951623",
    { headers },
  );
  const lupoDetail = await lupo.json();
  const lupoShip = resolveMinShipping(lupoDetail.shippingOptions, "GBP");
  console.log("\n=== SPOT CHECK: lupo-store item 306176878569 ===");
  console.log(`Price: ${formatPrice(parseFloat(lupoDetail.price.value), "GBP")}`);
  console.log(`Shipping tiers: ${lupoDetail.shippingOptions?.length}`);
  console.log(`Shipping label: ${lupoShip.label}`);
  console.log(
    `Total: ${lupoShip.multipleTiers ? `from ${formatPrice(parseFloat(lupoDetail.price.value) + (lupoShip.minCost ?? 0), "GBP")}` : formatPrice(parseFloat(lupoDetail.price.value) + (lupoShip.minCost ?? 0), "GBP")}`,
  );
}

main().catch(console.error);
