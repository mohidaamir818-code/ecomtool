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

const UK_FEEDS = [
  "AEB_UK_LocalStock_PlatformOperation_20240926",
  "AEB_UK_AvasamSelectedItems_ShipFromUK_20241126",
  "AEB_UK Local Items",
];

for (const feed_name of UK_FEEDS) {
  const res = await callDs("aliexpress.ds.recommend.feed.get", {
    feed_name,
    country: "GB",
    page_size: "5",
    page_no: "1",
    target_currency: "GBP",
    target_language: "EN",
  });
  const products = res.result?.products || [];
  console.log("\n", feed_name, "count", products.length);
  for (const p of products.slice(0, 2)) {
    const id = p.product_id;
    const detail = await callDs("aliexpress.ds.product.get", {
      product_id: String(id),
      ship_to_country: "GB",
      target_currency: "GBP",
      target_language: "EN",
    });
    const logistics = detail.result?.logistics_info_dto;
    console.log(" ", id, p.product_title?.slice(0, 50), "dt", logistics?.delivery_time, "price", p.target_sale_price);
  }
}
