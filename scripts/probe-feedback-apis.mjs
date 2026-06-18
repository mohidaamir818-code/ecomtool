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

function signHmac(params, secret) {
  const sorted = Object.keys(params)
    .filter((k) => k !== "sign")
    .sort()
    .map((k) => k + params[k])
    .join("");
  return crypto
    .createHmac("sha256", secret)
    .update(sorted, "utf8")
    .digest("hex")
    .toUpperCase();
}

async function call(method, businessParams) {
  const params = {
    app_key: process.env.ALIEXPRESS_APP_KEY,
    method,
    sign_method: "sha256",
    timestamp: String(Date.now()),
    format: "json",
    simplify: "true",
    session: tokenRow.access_token,
    ...businessParams,
  };
  params.sign = signHmac(params, process.env.ALIEXPRESS_APP_SECRET);
  const r = await fetch("https://api-sg.aliexpress.com/sync", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams(params),
  });
  return r.json();
}

const methods = [
  ["aliexpress.ds.feedback.query", { product_id: productId, page: "1", page_size: "10" }],
  ["aliexpress.ds.evaluation.list", { product_id: productId }],
  ["aliexpress.ds.product.sold.get", { product_id: productId }],
  ["aliexpress.ds.trade.get", { product_id: productId }],
  ["aliexpress.ds.product.stat.get", { product_id: productId }],
];

for (const [method, bp] of methods) {
  const res = await call(method, bp);
  console.log("\n", method, JSON.stringify(res).slice(0, 800));
}
