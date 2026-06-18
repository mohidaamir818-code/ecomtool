import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env.mjs";
import crypto from "crypto";

loadEnv();

const productId = process.argv[2] ?? "1005011923896571";
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
const appKey = process.env.ALIEXPRESS_APP_KEY;
const appSecret = process.env.ALIEXPRESS_APP_SECRET;

function signHmac(params, secret) {
  const sorted = Object.keys(params)
    .filter((k) => k !== "sign")
    .sort()
    .map((k) => k + params[k])
    .join("");
  return crypto.createHmac("sha256", secret).update(sorted, "utf8").digest("hex").toUpperCase();
}

async function callDs(method, businessParams) {
  const params = {
    app_key: appKey,
    method,
    sign_method: "sha256",
    timestamp: String(Date.now()),
    format: "json",
    simplify: "true",
    session: token,
    ...businessParams,
  };
  params.sign = signHmac(params, appSecret);
  const r = await fetch("https://api-sg.aliexpress.com/sync", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams(params),
  });
  return r.json();
}

const ds = await callDs("aliexpress.ds.product.get", {
  product_id: productId,
  ship_to_country: "GB",
  target_currency: "GBP",
  target_language: "EN",
});
console.log("DS keys:", Object.keys(ds));
console.log("DS sample:", JSON.stringify(ds).slice(0, 500));
console.log("store_info:", JSON.stringify(result.ae_store_info, null, 2));
console.log("base:", JSON.stringify(result.ae_item_base_info_dto, null, 2).slice(0, 1500));

const methods = [
  ["aliexpress.ds.recommend.feed.get", { country: "GB", page_size: "20", target_currency: "GBP", target_language: "EN" }],
  ["aliexpress.ds.product.wholesale.get", { product_id: productId, ship_to_country: "GB" }],
  ["aliexpress.ds.feedback.list", { product_id: productId, page: "1", page_size: "1" }],
  ["aliexpress.ds.product.review.get", { product_id: productId }],
];

for (const [method, bp] of methods) {
  const res = await callDs(method, bp);
  const text = JSON.stringify(res);
  const hits = [...text.matchAll(/(sales_count|lastest_volume|tradeCount|order|sold|volume)/gi)].length;
  console.log("\n", method, hits ? text.slice(0, 1200) : (res.error_response?.msg ?? "no hits"));
}
