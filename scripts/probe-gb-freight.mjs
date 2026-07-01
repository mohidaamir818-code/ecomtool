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

async function call(method, bp) {
  const params = {
    app_key: process.env.ALIEXPRESS_APP_KEY,
    method,
    sign_method: "sha256",
    timestamp: String(Date.now()),
    format: "json",
    v: "2.0",
    session: tokenRow.access_token,
    simplify: "true",
    ...bp,
  };
  params.sign = signHmac(params, process.env.ALIEXPRESS_APP_SECRET);
  const r = await fetch("https://api-sg.aliexpress.com/sync", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  return r.json();
}

async function freightGbOrigin(productId, skuId) {
  const dto = {
    product_id: String(productId),
    product_num: 1,
    country_code: "GB",
    send_goods_country_code: "GB",
  };
  if (skuId) dto.sku_id = String(skuId);
  const freight = await call("aliexpress.logistics.buyer.freight.calculate", {
    param_aeop_freight_calculate_for_buyer_d_t_o: JSON.stringify(dto),
  });
  const result = freight.result || freight.aliexpress_logistics_buyer_freight_calculate_response?.result;
  return result;
}

const keywords = [
  "uk warehouse",
  "ships from uk",
  "uk stock",
  "local uk",
  "united kingdom warehouse",
  "fast uk delivery",
];

let found = [];
for (const kw of keywords) {
  for (let page = 1; page <= 5; page++) {
    const search = await call("aliexpress.ds.text.search", {
      key_word: kw,
      local: "en",
      countryCode: "GB",
      currency: "GBP",
      pageSize: "20",
      pageIndex: String(page),
      sortType: "orders",
    });
    for (const p of search.data?.products || []) {
      const id = String(p.itemId);
      const detail = await call("aliexpress.ds.product.get", {
        product_id: id,
        ship_to_country: "GB",
        target_currency: "GBP",
        target_language: "EN",
      });
      const result = detail.result;
      const skus = result?.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o;
      const sku = Array.isArray(skus) ? skus[0] : skus;
      const freight = await freightGbOrigin(id, sku?.sku_id);
      if (freight?.success) {
        found.push({ id, kw, title: p.title?.slice(0, 70), freight });
      }
    }
    if (found.length) break;
  }
  if (found.length) break;
}

console.log("GB origin freight success count:", found.length);
for (const f of found.slice(0, 5)) {
  console.log(f.kw, f.id, f.title);
  console.log(JSON.stringify(f.freight, null, 2).slice(0, 800));
}

// brute: test first 100 products from generic search
if (!found.length) {
  console.log("brute scanning generic search...");
  let tested = 0;
  outer: for (let page = 1; page <= 10; page++) {
    const search = await call("aliexpress.ds.text.search", {
      key_word: "phone case",
      local: "en",
      countryCode: "GB",
      currency: "GBP",
      pageSize: "20",
      pageIndex: String(page),
      sortType: "orders",
    });
    for (const p of search.data?.products || []) {
      tested++;
      const id = String(p.itemId);
      const detail = await call("aliexpress.ds.product.get", {
        product_id: id,
        ship_to_country: "GB",
        target_currency: "GBP",
        target_language: "EN",
      });
      const skus = detail.result?.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o;
      const sku = Array.isArray(skus) ? skus[0] : skus;
      const freight = await freightGbOrigin(id, sku?.sku_id);
      if (freight?.success) {
        found.push({ id, title: p.title?.slice(0, 70), freight });
        console.log("FOUND", id, p.title?.slice(0, 60));
        console.log(JSON.stringify(freight, null, 2).slice(0, 500));
        if (found.length >= 3) break outer;
      }
    }
  }
  console.log("tested", tested, "found", found.length);
}
