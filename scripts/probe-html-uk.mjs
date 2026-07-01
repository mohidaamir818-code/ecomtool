import { loadEnv } from "./load-env.mjs";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

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

async function productGet(id) {
  const params = {
    app_key: process.env.ALIEXPRESS_APP_KEY,
    method: "aliexpress.ds.product.get",
    sign_method: "sha256",
    timestamp: String(Date.now()),
    format: "json",
    simplify: "true",
    v: "2.0",
    session: tokenRow.access_token,
    product_id: String(id),
    ship_to_country: "GB",
    target_currency: "GBP",
    target_language: "EN",
  };
  params.sign = signHmac(params, process.env.ALIEXPRESS_APP_SECRET);
  const r = await fetch("https://api-sg.aliexpress.com/sync", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  return r.json();
}

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-GB,en;q=0.9",
};

for (const shipFrom of ["GB", "UK", "US"]) {
  const url = `https://www.aliexpress.com/w/wholesale-phone-case.html?SearchText=phone+case&shipFromCountry=${shipFrom}&sortType=total_tranpro_desc&page=1`;
  const response = await fetch(url, { headers });
  const html = await response.text();
  const productIds = [...new Set([...html.matchAll(/"productId":"(\d+)"/g)].map((m) => m[1]))];
  const origins = [...html.matchAll(/"shipFrom":"([^"]+)"/g)].map((m) => m[1]);
  const counts = {};
  for (const o of origins) counts[o] = (counts[o] || 0) + 1;
  console.log("\nshipFrom", shipFrom, "status", response.status, "ids", productIds.length, "origin counts", counts);
  for (const id of productIds.slice(0, 3)) {
    const detail = await productGet(id);
    const logistics = detail.result?.logistics_info_dto;
    const title = detail.result?.ae_item_base_info_dto?.subject?.slice(0, 60);
    console.log(" ", id, "dt", logistics?.delivery_time, title);
  }
}
