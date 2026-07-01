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

async function call(method, bp, signMethod = "sha256") {
  const params = {
    app_key: process.env.ALIEXPRESS_APP_KEY,
    method,
    sign_method: signMethod,
    timestamp: String(Date.now()),
    format: "json",
    v: "2.0",
    session: tokenRow.access_token,
    ...bp,
  };
  if (!("simplify" in bp)) params.simplify = "true";
  if (signMethod === "md5") {
    const secret = process.env.ALIEXPRESS_APP_SECRET;
    const sorted = Object.keys(params)
      .filter((k) => k !== "sign")
      .sort()
      .map((k) => k + params[k])
      .join("");
    params.sign = crypto.createHash("md5").update(secret + sorted + secret, "utf8").digest("hex").toUpperCase();
  } else {
    params.sign = signHmac(params, process.env.ALIEXPRESS_APP_SECRET);
  }
  const r = await fetch("https://api-sg.aliexpress.com/sync", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  return r.json();
}

// affiliate search with delivery_days
const aff = await call(
  "aliexpress.affiliate.product.query",
  {
    app_signature: "sha256",
    keywords: "phone case",
    target_currency: "GBP",
    target_language: "EN",
    ship_to_country: "GB",
    delivery_days: "3",
    page_no: "1",
    page_size: "10",
    fields: "product_id,product_title,ship_to_days,target_sale_price",
  },
  "md5",
);
console.log("affiliate err:", aff.error_response?.msg || aff.error_response?.sub_msg);
const affProducts = aff.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || [];
const affList = Array.isArray(affProducts) ? affProducts : affProducts ? [affProducts] : [];
console.log("affiliate count", affList.length);
if (affList[0]) console.log("sample", affList[0]);

// freight full dump for multiple send countries
const id = "1005009049366794";
for (const from of ["GB", "UK", "CN", "US", "DE", "FR"]) {
  const freight = await call("aliexpress.logistics.buyer.freight.calculate", {
    param_aeop_freight_calculate_for_buyer_d_t_o: JSON.stringify({
      product_id: id,
      product_num: 1,
      country_code: "GB",
      send_goods_country_code: from,
    }),
  });
  const result = freight.result || freight.aliexpress_logistics_buyer_freight_calculate_response?.result;
  const list = result?.aeop_freight_calculate_result_for_buyer_d_t_o_list?.aeop_freight_calculate_result_for_buyer_dto;
  const options = Array.isArray(list) ? list : list ? [list] : [];
  console.log("from", from, "success", result?.success, "options", options.length, options[0]?.estimated_delivery_time || options[0]?.freight?.cent);
}

// sku info for ship from
const detail = await call("aliexpress.ds.product.get", {
  product_id: id,
  ship_to_country: "GB",
  target_currency: "GBP",
  target_language: "EN",
  simplify: "false",
});
const result = detail.aliexpress_ds_product_get_response?.result || detail.result;
const skus = result?.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o;
const skuList = Array.isArray(skus) ? skus : skus ? [skus] : [];
console.log("\nsku count", skuList.length);
if (skuList[0]) console.log("sku keys", Object.keys(skuList[0]));
console.log("sku0 sample", JSON.stringify(skuList[0], null, 2).slice(0, 1500));
