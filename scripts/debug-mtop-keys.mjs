import crypto from "crypto";

const MTOP_APP_KEY = "12574478";
const md5 = (v) => crypto.createHash("md5").update(v, "utf8").digest("hex");

async function fetchMtop(productId) {
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
      "User-Agent": "Mozilla/5.0",
      Referer: `https://www.aliexpress.com/item/${productId}.html`,
      Cookie: Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    },
  });
  const text = await r.text();
  const m = text.match(/mtopjsonp1\(([\s\S]*)\)/);
  if (!m) {
    console.log(text.slice(0, 500));
    return;
  }
  const payload = JSON.parse(m[1]);
  console.log("ret:", payload.ret);
  const result = payload.data?.result ?? payload.data;
  console.log("keys:", result ? Object.keys(result) : "none");
  if (result?.GLOBAL_DATA) console.log("error:", result.GLOBAL_DATA?.globalData?.errorCode);
}

await fetchMtop(process.argv[2] ?? "1005007170995524");
