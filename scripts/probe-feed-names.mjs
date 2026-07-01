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

async function callDs(method, bp) {
  const params = {
    app_key: process.env.ALIEXPRESS_APP_KEY,
    method,
    sign_method: "sha256",
    timestamp: String(Date.now()),
    format: "json",
    simplify: "true",
    v: "2.0",
    session: tokenRow.access_token,
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

const feeds = [
  "uk_local",
  "UK_LOCAL",
  "uk_warehouse",
  "local_uk",
  "oversea_uk",
  "choice_uk",
  "ds_local_uk",
  "local_stock_uk",
  "ae_local_uk",
  "ae_uk_local",
  "global_uk",
  "best_seller",
  "hot_product",
  "recommend",
];

for (const feed_name of feeds) {
  const res = await callDs("aliexpress.ds.recommend.feed.get", {
    feed_name,
    country: "GB",
    page_size: "10",
    target_currency: "GBP",
    target_language: "EN",
  });
  const err = res.error_response?.sub_msg || res.error_response?.msg;
  const products = res.result?.products || res.data?.products || res.result?.product_list;
  const count = Array.isArray(products) ? products.length : products ? 1 : 0;
  console.log(feed_name, err || `products=${count}`, err ? "" : JSON.stringify(res).slice(0, 200));
}
