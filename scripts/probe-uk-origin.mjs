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

async function productGet(id, simplify) {
  const params = {
    app_key: process.env.ALIEXPRESS_APP_KEY,
    method: "aliexpress.ds.product.get",
    sign_method: "sha256",
    timestamp: String(Date.now()),
    format: "json",
    v: "2.0",
    session: tokenRow.access_token,
    product_id: String(id),
    ship_to_country: "GB",
    target_currency: "GBP",
    target_language: "EN",
    simplify: simplify ? "true" : "false",
  };
  params.sign = signHmac(params, process.env.ALIEXPRESS_APP_SECRET);
  const r = await fetch("https://api-sg.aliexpress.com/sync", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  return r.json();
}

async function freight(id, from) {
  const params = {
    app_key: process.env.ALIEXPRESS_APP_KEY,
    method: "aliexpress.logistics.buyer.freight.calculate",
    sign_method: "sha256",
    timestamp: String(Date.now()),
    format: "json",
    v: "2.0",
    session: tokenRow.access_token,
    param_aeop_freight_calculate_for_buyer_d_t_o: JSON.stringify({
      product_id: String(id),
      product_num: 1,
      country_code: "GB",
      send_goods_country_code: from,
    }),
  };
  params.sign = signHmac(params, process.env.ALIEXPRESS_APP_SECRET);
  const r = await fetch("https://api-sg.aliexpress.com/sync", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  return r.json();
}

// Try text search params for UK ship from
async function search(extra) {
  const params = {
    app_key: process.env.ALIEXPRESS_APP_KEY,
    method: "aliexpress.ds.text.search",
    sign_method: "sha256",
    timestamp: String(Date.now()),
    format: "json",
    simplify: "true",
    v: "2.0",
    session: tokenRow.access_token,
    key_word: "phone case",
    local: "en",
    countryCode: "GB",
    currency: "GBP",
    pageSize: "5",
    pageIndex: "1",
    sortType: "orders",
    ...extra,
  };
  params.sign = signHmac(params, process.env.ALIEXPRESS_APP_SECRET);
  const r = await fetch("https://api-sg.aliexpress.com/sync", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  return r.json();
}

const paramTests = [
  { shipFromCountry: "GB" },
  { ship_from_country: "GB" },
  { send_goods_country_code: "GB" },
  { localWarehouse: "true" },
  { local_warehouse: "true" },
  { choice: "true" },
  { g: "y" },
  { delivery_days: "3" },
  { deliveryDays: "3" },
];

for (const extra of paramTests) {
  const j = await search(extra);
  const err = j.error_response?.sub_msg || j.error_response?.msg;
  const count = j.data?.products?.length ?? 0;
  const sample = j.data?.products?.[0];
  console.log(
    JSON.stringify(extra),
    err || `count=${count}`,
    sample ? `type=${sample.type} dt=${sample.ship_to_days || sample.deliveryDays || "?"}` : "",
  );
}

// Full product.get dump keys for one product
const s = await search({});
const id = s.data?.products?.[0]?.itemId;
if (id) {
  const full = await productGet(id, false);
  const result = full.aliexpress_ds_product_get_response?.result || full.result;
  console.log("\nfull keys:", Object.keys(result || {}));
  console.log("logistics:", JSON.stringify(result?.logistics_info_dto, null, 2));
  const freightGb = await freight(id, "GB");
  const freightCn = await freight(id, "CN");
  console.log("freight GB from GB success:", freightGb.result?.success, freightGb.result?.aeop_freight_calculate_result_for_buyer_d_t_o_list?.aeop_freight_calculate_result_for_buyer_dto?.length);
  console.log("freight GB from CN success:", freightCn.result?.success, freightCn.result?.aeop_freight_calculate_result_for_buyer_d_t_o_list?.aeop_freight_calculate_result_for_buyer_dto?.length);
}
