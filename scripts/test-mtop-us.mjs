import crypto from "crypto";

const MTOP_APP_KEY = "12574478";
const productId = process.argv[2] ?? "1005011923896571";
const hosts = ["https://acs.aliexpress.us", "https://acs.aliexpress.com"];

function md5(v) {
  return crypto.createHash("md5").update(v, "utf8").digest("hex");
}

function parseCookies(headers) {
  const cookies = {};
  for (const h of headers) {
    const part = h.split(";")[0];
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
let r = await fetch(`https://www.aliexpress.com/item/${productId}.html`, {
  headers,
  redirect: "follow",
});
Object.assign(cookies, parseCookies(r.headers.getSetCookie?.() ?? []));

for (const host of hosts) {
  const bootstrap =
    `${host}/h5/mtop.aliexpress.pdp.pc.query/1.0/?` +
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
  r = await fetch(bootstrap, {
    headers: {
      ...headers,
      Referer: `https://www.aliexpress.com/item/${productId}.html`,
      Cookie: cookieHeader(cookies),
    },
  });
  Object.assign(cookies, parseCookies(r.headers.getSetCookie?.() ?? []));
  console.log(host, "cookies", Object.keys(cookies), "tk", cookies._m_h5_tk?.slice(0, 25));
}

const token = (cookies._m_h5_tk ?? "").split("_")[0];
if (!token) {
  console.log("still no token");
  process.exit(0);
}

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
const timestamp = Date.now();
const sign = md5(`${token}&${timestamp}&${MTOP_APP_KEY}&${data}`);

for (const host of hosts) {
  const url =
    `${host}/h5/mtop.aliexpress.pdp.pc.query/1.0/?` +
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
  const m = text.match(/mtopjsonp1\(([\s\S]*)\)/);
  console.log("\n", host, "ret snippet", text.slice(0, 120));
  if (m) {
    const payload = JSON.parse(m[1]);
    console.log("ret", payload.ret);
    const modules = payload.data?.result ?? payload.data ?? {};
    console.log("PC_RATING", modules.PC_RATING);
    console.log("keys", Object.keys(modules).filter((k) => /trade|rating|sold/i.test(k)));
  }
}
