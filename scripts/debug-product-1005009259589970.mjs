import crypto from "crypto";
import fs from "fs";

const MTOP_APP_KEY = "12574478";
const md5 = (v) => crypto.createHash("md5").update(v, "utf8").digest("hex");

async function fetchMtop(productId) {
  const boot = await fetch(
    `https://acs.aliexpress.com/h5/mtop.aliexpress.pdp.pc.query/1.0/?jsv=2.5.1&appKey=${MTOP_APP_KEY}&t=${Date.now()}&sign=x&api=mtop.aliexpress.pdp.pc.query&v=1.0&type=originaljsonp&dataType=originaljsonp&callback=mtopjsonp1&data=%7B%7D`,
    { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36", Referer: "https://www.aliexpress.com/" } },
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
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
      Referer: `https://www.aliexpress.com/item/${productId}.html`,
      Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; "),
    },
  });
  const text = await r.text();
  const m = text.match(/mtopjsonp1\(([\s\S]*)\)/);
  if (!m) {
    console.log("FAIL:", text.slice(0, 400));
    return null;
  }
  const payload = JSON.parse(m[1]);
  console.log("ret:", payload.ret);
  return payload.data?.result ?? payload.data;
}

const id = "1005009259589970";
let d = null;
for (let attempt = 0; attempt < 3; attempt++) {
  d = await fetchMtop(id);
  if (d?.PRICE) break;
  console.log("retry", attempt + 1);
  await new Promise((r) => setTimeout(r, 2000));
}
if (!d) process.exit(1);

fs.writeFileSync("scripts/debug-vacuum-PRICE.json", JSON.stringify(d.PRICE, null, 2));
fs.writeFileSync("scripts/debug-vacuum-QUANTITY.json", JSON.stringify(d.QUANTITY_PC, null, 2));
fs.writeFileSync("scripts/debug-vacuum-PRICE_BANNER.json", JSON.stringify(d.PRICE_BANNER, null, 2));
fs.writeFileSync("scripts/debug-vacuum-BOTTOM_BAR.json", JSON.stringify(d.BOTTOM_BAR_PC, null, 2));

console.log("selectedSkuId:", d.PRICE?.selectedSkuId);
console.log("\ntargetSkuPriceInfo:", JSON.stringify(d.PRICE?.targetSkuPriceInfo, null, 2));
console.log("\nskuSecondPriceInfoMap:", JSON.stringify(d.PRICE?.skuSecondPriceInfoMap, null, 2));
console.log("\nQUANTITY_PC:", JSON.stringify(d.QUANTITY_PC, null, 2));
console.log("\nPRICE_BANNER keys:", d.PRICE_BANNER ? Object.keys(d.PRICE_BANNER) : null);
console.log("BOTTOM_BAR_PC:", JSON.stringify(d.BOTTOM_BAR_PC, null, 2)?.slice(0, 2000));
