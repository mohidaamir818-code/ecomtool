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

const methods = [
  ["aliexpress.ds.recommend.feed.get", { country: "GB", page_size: "20", target_currency: "GBP", target_language: "EN", feed_type: "UK_LOCAL" }],
  ["aliexpress.ds.recommend.feed.get", { country: "GB", page_size: "20", target_currency: "GBP", target_language: "EN", scene: "uk_local" }],
  ["aliexpress.ds.recommend.feed.get", { country: "GB", page_size: "20", target_currency: "GBP", target_language: "EN", local: "en_GB" }],
  ["aliexpress.ds.local.product.query", { ship_to_country: "GB", page_size: "20", page_no: "1" }],
  ["aliexpress.ds.choice.product.query", { ship_to_country: "GB", page_size: "20", page_no: "1" }],
  ["aliexpress.ds.warehouse.product.query", { warehouse_country: "GB", page_size: "20", page_no: "1" }],
  ["aliexpress.ds.oversea.product.query", { ship_to_country: "GB", page_size: "20", page_no: "1" }],
];

for (const [method, bp] of methods) {
  const res = await callDs(method, bp);
  const err = res.error_response?.sub_msg || res.error_response?.msg;
  const text = JSON.stringify(res);
  const ids = [...text.matchAll(/product_id|productId|itemId/gi)].length;
  console.log(method, err || `len=${text.length} idHits=${ids}`);
  if (!err && text.length > 100) console.log(text.slice(0, 500));
}
