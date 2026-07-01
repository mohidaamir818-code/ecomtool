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

const feednames = await callDs("aliexpress.ds.feedname.get", {});
console.log("feednames", JSON.stringify(feednames, null, 2).slice(0, 4000));

for (const feed_name of ["DS bestseller", "DS new arrival", "DS promotion", "DS local warehouse", "DS UK warehouse"]) {
  const res = await callDs("aliexpress.ds.recommend.feed.get", {
    feed_name,
    country: "GB",
    page_size: "10",
    page_no: "1",
    target_currency: "GBP",
    target_language: "EN",
  });
  const products = res.result?.products || [];
  console.log("\n", feed_name, "count", products.length);
  if (products[0]) console.log("sample", JSON.stringify(products[0]).slice(0, 300));
}
