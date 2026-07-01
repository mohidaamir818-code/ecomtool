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

// get a few product ids from search
const search = await call("aliexpress.ds.text.search", {
  key_word: "uk warehouse",
  local: "en",
  countryCode: "GB",
  currency: "GBP",
  pageSize: "10",
  pageIndex: "1",
  sortType: "orders",
});
const products = search.data?.products || [];
console.log("search count", products.length);

for (const p of products.slice(0, 5)) {
  const id = p.itemId || p.product_id;
  const detail = await call("aliexpress.ds.product.get", {
    product_id: String(id),
    ship_to_country: "GB",
    target_currency: "GBP",
    target_language: "EN",
  });
  const result = detail.result || detail.aliexpress_ds_product_get_response?.result;
  console.log("\n===", id, p.title?.slice(0, 60));
  console.log("logistics:", JSON.stringify(result?.logistics_info_dto, null, 2));
  const props = result?.ae_item_properties?.ae_item_property;
  const propList = Array.isArray(props) ? props : props ? [props] : [];
  const shipProps = propList.filter((x) =>
    /ship|origin|warehouse|from|stock/i.test(String(x.attr_name || x.attr_name_id || "")),
  );
  if (shipProps.length) console.log("ship props:", JSON.stringify(shipProps, null, 2));
}

// freight API for first product
if (products[0]) {
  const id = products[0].itemId;
  const freight = await call("aliexpress.logistics.buyer.freight.calculate", {
    param_aeop_freight_calculate_for_buyer_d_t_o: JSON.stringify({
      product_id: String(id),
      product_num: 1,
      country_code: "GB",
      send_goods_country_code: "GB",
    }),
  });
  console.log("\nfreight GB->GB:", JSON.stringify(freight, null, 2).slice(0, 2000));
}
