import crypto from "crypto";
import fs from "fs";
import path from "path";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

loadEnv();

const appKey = process.env.ALIEXPRESS_APP_KEY ?? "";
const appSecret = (process.env.ALIEXPRESS_APP_SECRET ?? process.env.ALIEXPRESS_APP__SECRET ?? "").trim();
const accessToken = process.env.ALIEXPRESS_ACCESS_TOKEN ?? "";
const productId = "1005010230088708";
const ENDPOINT = "https://api-sg.aliexpress.com/sync";

function signSha256(params, secret) {
  const method = params.method;
  const sorted = Object.keys(params)
    .filter((k) => k !== "sign")
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return crypto.createHmac("sha256", secret).update(`${method}${sorted}`, "utf8").digest("hex").toUpperCase();
}

async function call(label, params) {
  params.sign_method = "sha256";
  params.sign = signSha256(params, appSecret);
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams(params),
  });
  const json = await response.json();
  const err = json.error_response;
  console.log(`\n${label}: ${err?.code ?? "SUCCESS"}`);
  if (!err) console.log(JSON.stringify(json, null, 2).slice(0, 1200));
  else console.log(err.msg);
}

const ts = String(Date.now());

await call("ds slash method", {
  app_key: appKey,
  format: "json",
  timestamp: ts,
  method: "/aliexpress.ds.product.get",
  simplify: "true",
  session: accessToken,
  product_id: productId,
  ship_to_country: "GB",
  target_currency: "GBP",
  target_language: "EN",
});

await call("ds dot method", {
  app_key: appKey,
  format: "json",
  timestamp: ts,
  method: "aliexpress.ds.product.get",
  simplify: "true",
  session: accessToken,
  product_id: productId,
  ship_to_country: "GB",
  target_currency: "GBP",
  target_language: "EN",
});

await call("affiliate slash", {
  app_key: appKey,
  format: "json",
  timestamp: ts,
  method: "/aliexpress.affiliate.productdetail.get",
  simplify: "true",
  product_ids: productId,
  target_currency: "GBP",
  target_language: "EN",
});

await call("affiliate dot md5", {
  app_key: appKey,
  format: "json",
  v: "2.0",
  timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
  method: "aliexpress.affiliate.productdetail.get",
  product_ids: productId,
  target_currency: "GBP",
  target_language: "EN",
  sign_method: "md5",
  sign: crypto
    .createHash("md5")
    .update(
      `${appSecret}${Object.keys({
        app_key: appKey,
        format: "json",
        v: "2.0",
        timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
        method: "aliexpress.affiliate.productdetail.get",
        product_ids: productId,
        target_currency: "GBP",
        target_language: "EN",
      })
        .sort()
        .map((k) => `${k}${{
          app_key: appKey,
          format: "json",
          v: "2.0",
          timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
          method: "aliexpress.affiliate.productdetail.get",
          product_ids: productId,
          target_currency: "GBP",
          target_language: "EN",
        }[k]}`)
        .join("")}${appSecret}`,
      "utf8",
    )
    .digest("hex")
    .toUpperCase(),
});
