import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env.mjs";
import crypto from "crypto";

loadEnv();

const productId = "1005011923896571";
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

const params = {
  app_key: process.env.ALIEXPRESS_APP_KEY,
  method: "aliexpress.ds.product.get",
  sign_method: "sha256",
  timestamp: String(Date.now()),
  format: "json",
  simplify: "true",
  session: tokenRow.access_token,
  product_id: productId,
  ship_to_country: "GB",
  target_currency: "GBP",
  target_language: "EN",
};
params.sign = signHmac(params, process.env.ALIEXPRESS_APP_SECRET);

const r = await fetch("https://api-sg.aliexpress.com/sync", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
  body: new URLSearchParams(params),
});
const data = await r.json();
const result = data.result ?? data.aliexpress_ds_product_get_response?.result;
console.log("ae_store_info", JSON.stringify(result.ae_store_info, null, 2));
console.log("logistics", JSON.stringify(result.logistics_info_dto, null, 2));
