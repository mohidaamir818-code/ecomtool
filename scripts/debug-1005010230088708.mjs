import crypto from "crypto";
import fs from "fs";

const MTOP_APP_KEY = "12574478";
const md5 = (v) => crypto.createHash("md5").update(v, "utf8").digest("hex");

async function fetchMtop(productId, attempt = 0) {
  await new Promise((r) => setTimeout(r, attempt * 2500));
  const boot = await fetch(
    `https://acs.aliexpress.com/h5/mtop.aliexpress.pdp.pc.query/1.0/?jsv=2.5.1&appKey=${MTOP_APP_KEY}&t=${Date.now()}&sign=x&api=mtop.aliexpress.pdp.pc.query&v=1.0&type=originaljsonp&dataType=originaljsonp&callback=mtopjsonp1&data=%7B%7D`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://www.aliexpress.com/",
        "Accept-Language": "en-GB,en;q=0.9",
      },
    },
  );
  const cookies = {};
  for (const h of boot.headers.getSetCookie?.() ?? []) {
    const p = h.split(";")[0];
    const i = p.indexOf("=");
    if (i > 0) cookies[p.slice(0, i)] = p.slice(i + 1);
  }
  const token = (cookies._m_h5_tk ?? "").split("_")[0];
  const data = JSON.stringify({
    productId: String(productId),
    _lang: "en_GB",
    _currency: "GBP",
    country: "GB",
    province: "",
    city: "",
    clientType: "pc",
    ext: JSON.stringify({ foreverRandomToken: md5(String(Date.now())) }),
  });
  const t = Date.now();
  const sign = md5(`${token}&${t}&${MTOP_APP_KEY}&${data}`);
  const url =
    `https://acs.aliexpress.com/h5/mtop.aliexpress.pdp.pc.query/1.0/?` +
    new URLSearchParams({
      jsv: "2.5.1",
      appKey: MTOP_APP_KEY,
      t: String(t),
      sign,
      api: "mtop.aliexpress.pdp.pc.query",
      v: "1.0",
      type: "originaljsonp",
      dataType: "originaljsonp",
      callback: "mtopjsonp1",
      data,
    });
  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: `https://www.aliexpress.com/item/${productId}.html`,
      "Accept-Language": "en-GB,en;q=0.9",
      Cookie: Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    },
  });
  const text = await r.text();
  const m = text.match(/mtopjsonp1\(([\s\S]*)\)/);
  if (!m) return { error: text.slice(0, 300) };
  const payload = JSON.parse(m[1]);
  return payload;
}

const id = "1005010230088708";
let payload = null;
for (let i = 0; i < 5; i++) {
  payload = await fetchMtop(id, i);
  if (payload.ret?.some((r) => r.startsWith("SUCCESS"))) break;
  console.log("attempt", i + 1, payload.ret);
}

if (!payload?.data) {
  console.log("FAILED", payload);
  process.exit(1);
}

const d = payload.data?.result ?? payload.data;
fs.writeFileSync("scripts/debug-1005010230088708.json", JSON.stringify(d, null, 2));

console.log("TITLE:", d.PRODUCT_TITLE?.text?.slice(0, 80));
console.log("selectedSkuId:", d.PRICE?.selectedSkuId);
console.log("targetSkuPriceInfo:", JSON.stringify(d.PRICE?.targetSkuPriceInfo, null, 2));
console.log("skuPriceInfoMap:", JSON.stringify(d.PRICE?.skuPriceInfoMap, null, 2));
console.log("skuSecondPriceInfoMap:", JSON.stringify(d.PRICE?.skuSecondPriceInfoMap, null, 2));
console.log("QUANTITY_PC:", JSON.stringify(d.QUANTITY_PC, null, 2));
console.log("BOTTOM_BAR_PC:", JSON.stringify(d.BOTTOM_BAR_PC, null, 2));
console.log("PRICE_BANNER:", JSON.stringify(d.PRICE_BANNER, null, 2)?.slice(0, 1500));
