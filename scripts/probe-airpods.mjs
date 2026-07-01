import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env.mjs";

loadEnv();

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const { data: tokenRow } = await sb
  .from("aliexpress_oauth_tokens")
  .select("access_token")
  .eq("provider", "aliexpress")
  .maybeSingle();
const token = tokenRow?.access_token;

function signHmac(params, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(
      Object.keys(params)
        .filter((k) => k !== "sign")
        .sort()
        .map((k) => k + params[k])
        .join(""),
      "utf8",
    )
    .digest("hex")
    .toUpperCase();
}

function signMd5(params, secret) {
  return crypto
    .createHash("md5")
    .update(
      secret +
        Object.keys(params)
          .filter((k) => k !== "sign")
          .sort()
          .map((k) => k + params[k])
          .join("") +
        secret,
      "utf8",
    )
    .digest("hex")
    .toUpperCase();
}

async function dsSearch(kw, extra = {}) {
  const params = {
    app_key: process.env.ALIEXPRESS_APP_KEY,
    method: "aliexpress.ds.text.search",
    sign_method: "sha256",
    timestamp: String(Date.now()),
    format: "json",
    v: "2.0",
    session: token,
    key_word: kw,
    local: "en",
    countryCode: "GB",
    currency: "GBP",
    pageSize: "30",
    pageIndex: "1",
    ...extra,
  };
  params.sign = signHmac(params, process.env.ALIEXPRESS_APP_SECRET);
  return fetch("https://api-sg.aliexpress.com/sync", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  }).then((r) => r.json());
}

async function affSearch(kw, extra = {}) {
  const affKey = process.env.ALIEXPRESS_AFFILIATE_APP_KEY || process.env.ALIEXPRESS_APP_KEY;
  const affSec = process.env.ALIEXPRESS_AFFILIATE_APP_SECRET || process.env.ALIEXPRESS_APP_SECRET;
  const params = {
    app_key: affKey,
    method: "aliexpress.affiliate.product.query",
    sign_method: "md5",
    timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
    format: "json",
    v: "2.0",
    keywords: kw,
    fields:
      "product_id,product_title,target_sale_price,target_sale_price_currency,ship_to_days,product_main_image_url,product_detail_url,evaluate_rate,lastest_volume",
    page_no: "1",
    page_size: "20",
    target_currency: "GBP",
    target_language: "EN",
    ship_to_country: "GB",
    sort: "LAST_VOLUME_DESC",
    ...extra,
  };
  params.sign = signMd5(params, affSec);
  return fetch("https://api-sg.aliexpress.com/sync", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  }).then((r) => r.json());
}

function titleMatchCount(products, kw) {
  const terms = kw.toLowerCase().split(/\s+/).filter(Boolean);
  return products.filter((p) => {
    const title = String(p.title || p.product_title || "").toLowerCase();
    return terms.every((t) => title.includes(t));
  }).length;
}

const simp = await dsSearch("airpods", { simplify: "true", sortType: "default" });
const simpProducts = simp.data?.products ?? [];
console.log("ds simplify products", simpProducts.length, "title match", titleMatchCount(simpProducts, "airpods"));
for (const p of simpProducts.slice(0, 3)) {
  console.log(" ds", p.targetSalePrice, p.targetSalePriceCurrency || p.salePriceCurrency, p.title?.slice(0, 50));
}

const aff = await affSearch("airpods");
let items = aff.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product;
items = Array.isArray(items) ? items : items ? [items] : [];
console.log("\naffiliate products", items.length, "title match", titleMatchCount(items, "airpods"));
for (const p of items.slice(0, 5)) {
  console.log(" aff", p.target_sale_price, p.target_sale_price_currency, p.product_title?.slice(0, 50));
}

const aff3 = await affSearch("airpods", { delivery_days: "3" });
items = aff3.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product;
items = Array.isArray(items) ? items : items ? [items] : [];
console.log("\naffiliate 3-day", items.length);
for (const p of items.slice(0, 5)) {
  console.log(" aff3", p.target_sale_price, p.ship_to_days, p.product_title?.slice(0, 50));
}

// scan ds pages for airpods in title
let found = 0;
for (let page = 1; page <= 10; page++) {
  const res = await dsSearch("airpods", { simplify: "true", pageIndex: String(page), sortType: "default" });
  const ps = res.data?.products ?? [];
  found += titleMatchCount(ps, "airpods");
}
console.log("\nds pages 1-10 title matches total", found);
