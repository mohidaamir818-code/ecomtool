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

async function freight(productId, skuId, from) {
  const dto = {
    product_id: String(productId),
    product_num: 1,
    country_code: "GB",
    send_goods_country_code: from,
  };
  if (skuId) dto.sku_id = String(skuId);
  return call("aliexpress.logistics.buyer.freight.calculate", {
    param_aeop_freight_calculate_for_buyer_d_t_o: JSON.stringify(dto),
  });
}

// scan for delivery_time <= 3
let ukCandidates = [];
for (let page = 1; page <= 40 && ukCandidates.length < 8; page++) {
  const search = await call("aliexpress.ds.text.search", {
    simplify: "true",
    key_word: "uk",
    local: "en",
    countryCode: "GB",
    currency: "GBP",
    pageSize: "20",
    pageIndex: String(page),
    sortType: "orders",
  });
  for (const p of search.data?.products || []) {
    const id = String(p.itemId);
    const detail = await call("aliexpress.ds.product.get", {
      simplify: "false",
      product_id: id,
      ship_to_country: "GB",
      target_currency: "GBP",
      target_language: "EN",
    });
    const result = detail.result || detail.aliexpress_ds_product_get_response?.result;
    const dt = Number(result?.logistics_info_dto?.delivery_time);
    if (dt && dt <= 3) {
      const skus = result?.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o;
      const sku = Array.isArray(skus) ? skus[0] : skus;
      ukCandidates.push({ id, dt, title: p.title?.slice(0, 60), skuId: sku?.sku_id, logistics: result?.logistics_info_dto, package: result?.package_info_dto });
    }
  }
  process.stdout.write(".");
}

console.log("\nfast:", ukCandidates.length);
for (const c of ukCandidates) {
  console.log("\n", c.dt, c.id, c.title);
  console.log(" logistics", JSON.stringify(c.logistics));
  console.log(" package", JSON.stringify(c.package));
  const fGb = await freight(c.id, c.skuId, "GB");
  const fCn = await freight(c.id, c.skuId, "CN");
  console.log(" freight GB", JSON.stringify(fGb.result || fGb).slice(0, 400));
  console.log(" freight CN", JSON.stringify(fCn.result || fCn).slice(0, 400));
}
