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
const promos = feednames.resp_result?.result?.promos || [];
const matches = promos.filter((p) =>
  /uk|gb|united kingdom|localstock|shipfromuk|_us_|shipfromus/i.test(p.promo_name),
);
console.log("matching feeds", matches.length);
for (const p of matches) console.log(p.promo_name, p.product_num);

console.log("sample product", JSON.stringify(res.result?.products?.[0], null, 2));

// US local stock feeds
const usFeeds = promos.filter((p) => /shipfromus|_us_local|us_localstock|ship_to_us/i.test(p.promo_name));
console.log("\nUS feeds", usFeeds.length);
for (const p of usFeeds.slice(0, 10)) console.log(p.promo_name, p.product_num);
