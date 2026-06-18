import crypto from "crypto";

const MTOP_APP_KEY = "12574478";
const MTOP_HOST = "https://acs.aliexpress.com";
const productId = process.argv[2] ?? "1005011923896571";

function md5(value) {
  return crypto.createHash("md5").update(value, "utf8").digest("hex");
}

function parseCookies(setCookieHeaders) {
  const cookies = {};
  for (const header of setCookieHeaders) {
    const part = header.split(";")[0];
    const eq = part.indexOf("=");
    if (eq > 0) cookies[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return cookies;
}

function cookieHeader(cookies) {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
}

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-GB,en;q=0.9",
};

let cookies = {};

// Visit homepage
let r = await fetch("https://www.aliexpress.com/", { headers, redirect: "follow" });
Object.assign(cookies, parseCookies(r.headers.getSetCookie?.() ?? []));
console.log("after home:", Object.keys(cookies));

// Visit product page
r = await fetch(`https://www.aliexpress.com/item/${productId}.html`, {
  headers: { ...headers, Cookie: cookieHeader(cookies) },
  redirect: "follow",
});
Object.assign(cookies, parseCookies(r.headers.getSetCookie?.() ?? []));
const html = await r.text();
console.log("after pdp:", Object.keys(cookies), "html", html.length);

// Bootstrap mtop
const bootstrapUrl =
  `${MTOP_HOST}/h5/mtop.aliexpress.pdp.pc.query/1.0/?` +
  new URLSearchParams({
    jsv: "2.5.1",
    appKey: MTOP_APP_KEY,
    t: String(Date.now()),
    sign: "abc123",
    api: "mtop.aliexpress.pdp.pc.query",
    v: "1.0",
    type: "originaljsonp",
    dataType: "originaljsonp",
    callback: "mtopjsonp1",
    data: "{}",
  });

r = await fetch(bootstrapUrl, {
  headers: { ...headers, Referer: `https://www.aliexpress.com/item/${productId}.html`, Cookie: cookieHeader(cookies) },
});
Object.assign(cookies, parseCookies(r.headers.getSetCookie?.() ?? []));
console.log("after bootstrap:", Object.keys(cookies), "_m_h5_tk", cookies._m_h5_tk?.slice(0, 20));

const token = (cookies._m_h5_tk ?? "").split("_")[0];
if (!token) {
  console.log("No token, trying scrape html for sold patterns");
  const sold = [...html.matchAll(/(\d[\d,]*)\s*(sold|orders)/gi)].map((m) => m[0]);
  console.log("sold patterns:", sold);
  process.exit(0);
}

const data = JSON.stringify({
  productId: String(productId),
  _lang: "en_GB",
  _currency: "GBP",
  country: "GB",
  clientType: "pc",
  ext: JSON.stringify({ foreverRandomToken: md5(String(Date.now())) }),
});
const timestamp = Date.now();
const sign = md5(`${token}&${timestamp}&${MTOP_APP_KEY}&${data}`);
const url =
  `${MTOP_HOST}/h5/mtop.aliexpress.pdp.pc.query/1.0/?` +
  new URLSearchParams({
    jsv: "2.5.1",
    appKey: MTOP_APP_KEY,
    t: String(timestamp),
    sign,
    api: "mtop.aliexpress.pdp.pc.query",
    v: "1.0",
    type: "originaljsonp",
    dataType: "originaljsonp",
    callback: "mtopjsonp1",
    data,
  });

r = await fetch(url, {
  headers: {
    ...headers,
    Referer: `https://www.aliexpress.com/item/${productId}.html`,
    Cookie: cookieHeader(cookies),
  },
});
const text = await r.text();
const jsonMatch = text.match(/mtopjsonp1\(([\s\S]*)\)/);
if (!jsonMatch) {
  console.log("no jsonp", text.slice(0, 300));
  process.exit(0);
}
const payload = JSON.parse(jsonMatch[1]);
console.log("ret:", payload.ret);
const modules = payload.data?.result ?? payload.data ?? {};
console.log("PC_RATING:", modules.PC_RATING);
console.log("trade module keys:", Object.keys(modules).filter((k) => /trade|rating|sold|order/i.test(k)));
