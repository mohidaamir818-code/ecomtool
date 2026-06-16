import crypto from "crypto";

// Quick integration test mirroring src/lib/aliexpress/client.ts MTOP flow
const MTOP_APP_KEY = "12574478";
const md5 = (v) => crypto.createHash("md5").update(v, "utf8").digest("hex");

async function fetchProduct(url) {
  const resolved = (await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } })).url;
  const productId = resolved.match(/(\d{12,20})/)?.[1];
  if (!productId) throw new Error("no id");

  const boot = await fetch(
    `https://acs.aliexpress.com/h5/mtop.aliexpress.pdp.pc.query/1.0/?jsv=2.5.1&appKey=${MTOP_APP_KEY}&t=${Date.now()}&sign=x&api=mtop.aliexpress.pdp.pc.query&v=1.0&type=originaljsonp&dataType=originaljsonp&callback=mtopjsonp1&data=%7B%7D`,
    { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.aliexpress.com/" } },
  );
  const cookies = {};
  for (const h of boot.headers.getSetCookie?.() ?? []) {
    const p = h.split(";")[0];
    const i = p.indexOf("=");
    if (i > 0) cookies[p.slice(0, i)] = p.slice(i + 1);
  }
  const token = (cookies._m_h5_tk ?? "").split("_")[0];
  const data = JSON.stringify({
    productId,
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
  const mtopUrl =
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
  const r = await fetch(mtopUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: `https://www.aliexpress.com/item/${productId}.html`,
      Cookie: Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    },
  });
  const text = await r.text();
  const payload = JSON.parse(text.match(/mtopjsonp1\(([\s\S]*)\)/)[1]);
  const modules = payload.data?.result ?? payload.data;
  const title = modules.PRODUCT_TITLE?.text;
  const priceInfo =
    modules.PRICE?.targetSkuPriceInfo ?? Object.values(modules.PRICE?.skuPriceInfoMap ?? {})[0];
  console.log(
    JSON.stringify(
      {
        productId,
        title,
        price: priceInfo?.salePriceString ?? priceInfo?.originalPrice?.value,
        stock: modules.QUANTITY_PC?.totalAvailableInventory,
        orders: modules.PC_RATING?.otherText,
        rating: modules.PC_RATING?.rating,
      },
      null,
      2,
    ),
  );
}

const testUrl = process.argv[2] ?? "https://www.aliexpress.com/item/1005007170995524.html";
await fetchProduct(testUrl);
