import crypto from "crypto";
import fs from "fs";
import path from "path";
import { loadEnv, requireEnv } from "./load-env.mjs";

function clean(value) {
  if (!value) return "";
  const v = String(value).trim();
  if (!v || v.toLowerCase() === "pending" || v.startsWith("your-")) return "";
  return v;
}

function signHmacSha256(params, secret) {
  const method = params.method;
  const sorted = Object.keys(params)
    .filter((k) => k !== "sign")
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return crypto.createHmac("sha256", secret).update(`${method}${sorted}`, "utf8").digest("hex").toUpperCase();
}

function signHmacSha256NoMethodPrefix(params, secret) {
  const sorted = Object.keys(params)
    .filter((k) => k !== "sign")
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return crypto.createHmac("sha256", secret).update(sorted, "utf8").digest("hex").toUpperCase();
}

function stringToSignWithMethod(params) {
  const method = params.method;
  const sorted = Object.keys(params)
    .filter((k) => k !== "sign")
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return `${method}${sorted}`;
}

function stringToSignNoMethod(params) {
  return Object.keys(params)
    .filter((k) => k !== "sign")
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
}

async function getTokenFromSupabase() {
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !serviceKey) return "";

  const response = await fetch(
    `${url}/rest/v1/aliexpress_oauth_tokens?select=access_token,updated_at&provider=eq.aliexpress&order=updated_at.desc&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  );
  if (!response.ok) return "";
  const rows = await response.json();
  return clean(rows?.[0]?.access_token);
}

function normalizeSkuList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  const nested = raw.ae_item_sku_info_d_t_o ?? raw.ae_item_sku_info_dto ?? raw.ae_item_sku_info_DTO;
  if (Array.isArray(nested)) return nested;
  if (nested && typeof nested === "object") return [nested];
  return [];
}

loadEnv();

const input = process.argv[2] ?? "https://www.aliexpress.com/item/1005010629322687.html";
const productId = (input.match(/(\d{12,20})/) ?? [])[1];
if (!productId) {
  console.error("Could not parse productId from input URL");
  process.exit(1);
}

const appKey = requireEnv("ALIEXPRESS_APP_KEY");
const appSecret = requireEnv("ALIEXPRESS_APP_SECRET");

let accessToken = clean(process.env.ALIEXPRESS_ACCESS_TOKEN);
if (!accessToken) {
  accessToken = await getTokenFromSupabase();
}
if (!accessToken) {
  console.error("No ALIEXPRESS access token found in env or Supabase table");
  process.exit(1);
}

const params = {
  app_key: appKey,
  method: "aliexpress.ds.product.get",
  sign_method: "sha256",
  timestamp: String(Date.now()),
  format: "json",
  simplify: "true",
  session: accessToken,
  product_id: productId,
  ship_to_country: "GB",
  target_currency: "GBP",
  target_language: "EN",
};
const variants = [
  {
    name: "sha256_method_prefix",
    stringToSign: stringToSignWithMethod(params),
    sign: signHmacSha256(params, appSecret),
  },
  {
    name: "sha256_no_method_prefix",
    stringToSign: stringToSignNoMethod(params),
    sign: signHmacSha256NoMethodPrefix(params, appSecret),
  },
];

let payload = null;
for (const variant of variants) {
  console.log(`\n[Standalone ${variant.name}] stringToSign:`, variant.stringToSign);
  console.log(`[Standalone ${variant.name}] signature:`, variant.sign);
  const signed = { ...params, sign_method: "sha256", sign: variant.sign };
  const response = await fetch("https://api-sg.aliexpress.com/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams(signed),
  });
  const testPayload = await response.json();
  const testPath = path.join(process.cwd(), "scripts", `ds-raw-${productId}-${variant.name}.json`);
  fs.writeFileSync(testPath, JSON.stringify(testPayload, null, 2));
  console.log("Saved variant payload:", testPath);
  console.log("Variant", variant.name, "error:", testPayload.error_response?.code ?? "SUCCESS");
  if (!testPayload.error_response) {
    payload = testPayload;
    break;
  }
}

if (!payload) {
  payload = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "scripts", `ds-raw-${productId}-${variants[0].name}.json`), "utf8"),
  );
}
const outPath = path.join(process.cwd(), "scripts", `ds-raw-${productId}.json`);
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

console.log("Saved full raw payload:", outPath);

if (payload.error_response) {
  console.log("error_response:", JSON.stringify(payload.error_response, null, 2));
  process.exit(0);
}

const result = payload.aliexpress_ds_product_get_response?.result ?? {};
const base = result.ae_item_base_info_dto ?? {};
const skuList = normalizeSkuList(result.ae_item_sku_info_dtos);

console.log("\nTop-level/base price-ish fields:");
console.log(
  JSON.stringify(
    {
      currency_code: base.currency_code,
      subject: base.subject,
      avg_evaluation_rating: base.avg_evaluation_rating,
      evaluation_count: base.evaluation_count,
      product_status_type: base.product_status_type,
    },
    null,
    2,
  ),
);

const skuPrices = skuList.map((sku, idx) => ({
  idx,
  id: sku.id,
  sku_code: sku.sku_code,
  currency_code: sku.currency_code,
  sku_price: sku.sku_price,
  offer_sale_price: sku.offer_sale_price,
  offer_bulk_sale_price: sku.offer_bulk_sale_price,
  sku_bulk_order: sku.sku_bulk_order,
  ipm_sku_stock: sku.ipm_sku_stock,
  sku_available_stock: sku.sku_available_stock ?? sku.s_k_u_available_stock,
  sku_stock: sku.sku_stock,
  properties: sku.aeop_s_k_u_propertys ?? sku.ae_sku_property_dtos,
}));

console.log("\nAll SKU-level prices:");
console.log(JSON.stringify(skuPrices, null, 2));

console.log("\nCurrent UI price field logic in code:");
console.log("- Source: src/lib/aliexpress/client.ts -> parseDsProductPayload()");
console.log("- Per SKU price field used: offer_sale_price first, fallback sku_price");
console.log("- Selected value: lowest numeric SKU price among all SKUs");
