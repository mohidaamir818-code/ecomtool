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
const token = tokenRow?.access_token;

function sign(params, secret) {
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

function extractProducts(j) {
  const data = j.aliexpress_ds_text_search_response?.data || j.data;
  const products = data?.products;
  if (Array.isArray(products)) return { list: products, total: data?.totalCount };
  if (products?.selection_search_product) {
    const list = Array.isArray(products.selection_search_product)
      ? products.selection_search_product
      : [products.selection_search_product];
    return { list, total: data?.totalCount };
  }
  return { list: [], total: data?.totalCount };
}

function matchCount(list, kw) {
  const terms = kw.toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((p) => {
    const title = String(p.title || p.product_title || "").toLowerCase();
    return terms.every((t) => title.includes(t));
  }).length;
}

const extras = [
  {},
  { local: "en_GB" },
  { sortType: "default" },
  { sortType: "priceAsc" },
  { delivery_days: "3" },
  { deliveryDays: "3" },
  { scene: "search" },
  { search_scene: "search" },
  { bizScene: "search" },
  { productType: "search" },
  { simplify: "false" },
];

for (const extra of extras) {
  const params = {
    app_key: process.env.ALIEXPRESS_APP_KEY,
    method: "aliexpress.ds.text.search",
    sign_method: "sha256",
    timestamp: String(Date.now()),
    format: "json",
    v: "2.0",
    session: token,
    key_word: "airpods",
    countryCode: "GB",
    currency: "GBP",
    pageSize: "20",
    pageIndex: "1",
    ...extra,
  };
  if (!("simplify" in extra)) params.simplify = "true";
  params.sign = sign(params, process.env.ALIEXPRESS_APP_SECRET);
  const j = await fetch("https://api-sg.aliexpress.com/sync", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  }).then((r) => r.json());
  if (j.error_response) {
    console.log(JSON.stringify(extra), "ERR", j.error_response.sub_msg || j.error_response.msg);
    continue;
  }
  const { list, total } = extractProducts(j);
  const types = [...new Set(list.map((p) => p.type))];
  console.log(
    JSON.stringify(extra),
    "total",
    total,
    "count",
    list.length,
    "types",
    types,
    "matches",
    matchCount(list, "airpods"),
  );
}
