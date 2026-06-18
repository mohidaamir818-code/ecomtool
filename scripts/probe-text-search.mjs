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

const searches = [
  ["aliexpress.ds.text.search", { key_word: productId, local: "en", countryCode: "GB", currency: "GBP", pageSize: "20", pageIndex: "1" }],
  ["aliexpress.ds.text.search", { key_word: "120W PD 3.0 Fast Charging Station", local: "en", countryCode: "GB", currency: "GBP", pageSize: "20", pageIndex: "1" }],
  ["aliexpress.ds.image.searchV2", { image_base64: "", sort_type: "default", ship_to: "GB" }],
];

for (const [method, bp] of searches) {
  const res = await call(method, bp);
  const text = JSON.stringify(res);
  if (text.includes(productId)) {
    const idx = text.indexOf(productId);
    console.log("\n", method, "context:", text.slice(Math.max(0, idx - 200), idx + 400));
  } else {
    console.log("\n", method, res.error_response?.msg ?? res.rsp_msg ?? "no product id in response", text.slice(0, 300));
  }
}
