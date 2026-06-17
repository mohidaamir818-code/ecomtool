import crypto from "crypto";
import { loadEnv, requireEnv } from "./load-env.mjs";

loadEnv();

const appKey = requireEnv("ALIEXPRESS_APP_KEY");
const appSecret = requireEnv("ALIEXPRESS_APP_SECRET");

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

const testUrl = process.argv[2] ?? "https://www.aliexpress.com/item/1005006123456789.html";
const productIdMatch = testUrl.match(/(\d{9,20})/);
const productId = productIdMatch?.[1] ?? "1005006123456789";

console.log("Testing URL:", testUrl);
console.log("Product ID:", productId);

const params = {
  app_key: appKey,
  method: "aliexpress.affiliate.productdetail.get",
  sign_method: "md5",
  timestamp: formatTimestamp(),
  format: "json",
  v: "2.0",
  product_ids: productId,
  target_currency: "GBP",
  target_language: "EN",
};
params.sign = signParams(params, appSecret);

for (const endpoint of ["https://api-sg.aliexpress.com/sync", "https://gw.api.taobao.com/router/rest"]) {
  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: new URLSearchParams(params),
    });
    const text = await r.text();
    console.log("\nAPI", endpoint, "status:", r.status);
    console.log(text.slice(0, 1200));
  } catch (e) {
    console.log("\nAPI", endpoint, "error:", e.message);
  }
}

try {
  const r2 = await fetch(testUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-GB,en;q=0.9",
    },
    redirect: "follow",
  });
  console.log("\nHTML status:", r2.status, "final URL:", r2.url);
  const html = await r2.text();
  console.log("HTML length:", html.length);

  const patterns = [
    ["og:title", /property="og:title"\s+content="([^"]+)"/i],
    ["og:image", /property="og:image"\s+content="([^"]+)"/i],
    ["formattedPrice", /"formattedPrice"\s*:\s*"([^"]+)"/],
    ["minActivityAmount", /"minActivityAmount"\s*:\s*\{[^}]*"value"\s*:\s*([0-9.]+)/],
    ["runParams", /window\.runParams\s*=\s*(\{[\s\S]*?\});/],
    ["data:", /data:\s*(\{[\s\S]*?"priceModule"[\s\S]*?\})\s*,/],
  ];

  for (const [name, re] of patterns) {
    const m = html.match(re);
    if (m) console.log(`Found ${name}:`, String(m[1]).slice(0, 200));
    else console.log(`Missing ${name}`);
  }
} catch (e) {
  console.log("\nHTML error:", e.message);
}
