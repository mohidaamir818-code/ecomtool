import crypto from "crypto";

const appKey = process.env.ALIEXPRESS_APP_KEY ?? "537086";
const appSecret = (process.env.ALIEXPRESS_APP_SECRET ?? "").trim();
const productId = process.argv[2] ?? "1005005095908799";

function formatTimestamp() {
  const now = new Date();
  const pad = (v) => String(v).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function signParams(params, secret) {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return crypto.createHash("md5").update(`${secret}${sorted}${secret}`, "utf8").digest("hex").toUpperCase();
}

const methods = [
  {
    method: "aliexpress.affiliate.productdetail.get",
    extra: { product_ids: productId, target_currency: "GBP", target_language: "EN" },
  },
  {
    method: "aliexpress.affiliate.product.query",
    extra: {
      product_ids: productId,
      target_currency: "GBP",
      target_language: "EN",
      page_no: "1",
      page_size: "1",
    },
  },
  {
    method: "aliexpress.ds.product.get",
    extra: {
      product_id: productId,
      ship_to_country: "GB",
      target_currency: "GBP",
      target_language: "EN",
    },
  },
  {
    method: "aliexpress.ds.recommend.feed.get",
    extra: { country: "GB", target_currency: "GBP", target_language: "EN", page_size: "1" },
  },
];

for (const { method, extra } of methods) {
  const params = {
    app_key: appKey,
    method,
    sign_method: "md5",
    timestamp: formatTimestamp(),
    format: "json",
    v: "2.0",
    ...extra,
  };
  params.sign = signParams(params, appSecret);

  try {
    const r = await fetch("https://api-sg.aliexpress.com/sync", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: new URLSearchParams(params),
    });
    const text = await r.text();
    console.log("\n===", method, "===");
    console.log(text.slice(0, 2000));
  } catch (e) {
    console.log("\n===", method, "ERROR ===", e.message);
  }
}
