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

async function freight(id, skuId, from) {
  const dto = { product_id: String(id), product_num: 1, country_code: "GB", send_goods_country_code: from };
  if (skuId) dto.sku_id = String(skuId);
  const freight = await callDs("aliexpress.logistics.buyer.freight.calculate", {
    param_aeop_freight_calculate_for_buyer_d_t_o: JSON.stringify(dto),
  });
  return freight.result || freight.aliexpress_logistics_buyer_freight_calculate_response?.result;
}

const res = await callDs("aliexpress.ds.recommend.feed.get", {
  feed_name: "AEB_UK_AvasamSelectedItems_ShipFromUK_20241126",
  country: "GB",
  page_size: "5",
  page_no: "1",
  target_currency: "GBP",
  target_language: "EN",
});

for (const p of res.result?.products || []) {
  const id = p.product_id;
  const detail = await callDs("aliexpress.ds.product.get", {
    product_id: String(id),
    ship_to_country: "GB",
    target_currency: "GBP",
    target_language: "EN",
    simplify: "false",
  });
  const result = detail.result;
  const skus = result?.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o;
  const sku = Array.isArray(skus) ? skus[0] : skus;
  const fGb = await freight(id, sku?.sku_id, "GB");
  const fCn = await freight(id, sku?.sku_id, "CN");
  console.log("\n", p.product_title?.slice(0, 55));
  console.log(" dt", result?.logistics_info_dto?.delivery_time);
  console.log(" GB freight", fGb?.success, JSON.stringify(fGb).slice(0, 250));
  console.log(" CN freight", fCn?.success, JSON.stringify(fCn).slice(0, 250));
}
