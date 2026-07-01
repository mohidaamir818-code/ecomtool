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

// scan pages for low delivery_time products
let fast = [];
for (let page = 1; page <= 30; page++) {
  const search = await call("aliexpress.ds.text.search", {
    key_word: "earbuds",
    local: "en",
    countryCode: "GB",
    currency: "GBP",
    pageSize: "20",
    pageIndex: String(page),
    sortType: "orders",
    shpt_to: "GB",
  });
  const products = search.data?.products || [];
  if (!products.length) break;
  for (const p of products) {
    const id = String(p.itemId);
    const detail = await call("aliexpress.ds.product.get", {
      product_id: id,
      ship_to_country: "GB",
      target_currency: "GBP",
      target_language: "EN",
    });
    const logistics = detail.result?.logistics_info_dto;
    const dt = Number(logistics?.delivery_time);
    if (dt && dt <= 5) {
      fast.push({ id, dt, title: p.title?.slice(0, 70), logistics });
    }
    if (fast.length >= 15) break;
  }
  if (fast.length >= 15) break;
  process.stdout.write(".");
}
console.log("\nfast delivery products:", fast.length);
for (const f of fast.slice(0, 10)) {
  console.log(f.dt, f.id, f.title);
  console.log(" ", JSON.stringify(f.logistics));
}
