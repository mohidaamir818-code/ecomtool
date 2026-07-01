import crypto from "crypto";
import { loadEnv } from "./load-env.mjs";

loadEnv();

const MTOP_APP_KEY = "12574478";
const MTOP_HOST = "https://acs.aliexpress.com";
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-GB,en;q=0.9",
};

function md5(value) {
  return crypto.createHash("md5").update(value, "utf8").digest("hex");
}

function parseCookies(setCookieHeaders) {
  const cookies = {};
  for (const header of setCookieHeaders) {
    const part = header.split(";")[0];
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    cookies[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return cookies;
}

function cookieHeader(cookies) {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function bootstrapMtopCookies() {
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
    }).toString();

  const response = await fetch(bootstrapUrl, {
    headers: { ...BROWSER_HEADERS, Referer: "https://www.aliexpress.com/" },
    cache: "no-store",
  });

  return parseCookies(response.headers.getSetCookie?.() ?? []);
}

async function callMtop(api, version, dataObj, cookies) {
  const token = (cookies._m_h5_tk ?? "").split("_")[0];
  const data = JSON.stringify(dataObj);
  const timestamp = Date.now();
  const sign = md5(`${token}&${timestamp}&${MTOP_APP_KEY}&${data}`);
  const url =
    `${MTOP_HOST}/h5/${api}/${version}/?` +
    new URLSearchParams({
      jsv: "2.5.1",
      appKey: MTOP_APP_KEY,
      t: String(timestamp),
      sign,
      api,
      v: version,
      type: "originaljsonp",
      dataType: "originaljsonp",
      callback: "mtopjsonp1",
      data,
    }).toString();

  const response = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      Referer: "https://www.aliexpress.com/",
      Cookie: cookieHeader(cookies),
    },
    cache: "no-store",
  });

  const text = await response.text();
  const jsonMatch = text.match(/mtopjsonp1\(([\s\S]*)\)/);
  if (!jsonMatch) return { raw: text.slice(0, 300) };
  return JSON.parse(jsonMatch[1]);
}

const cookies = await bootstrapMtopCookies();
console.log("cookies", Object.keys(cookies));

const attempts = [
  [
    "mtop.relationrecommend.aliexpressrecommend.recommend",
    "1.0",
    {
      appId: 668,
      params: JSON.stringify({
        query: "airpods",
        locale: "en_GB",
        currency: "GBP",
        country: "GB",
        page: 1,
        pageSize: 20,
      }),
    },
  ],
  [
    "mtop.aliexpress.search.searchProduct",
    "1.0",
    {
      searchText: "airpods",
      page: 1,
      pageSize: 20,
      country: "GB",
      currency: "GBP",
      locale: "en_GB",
    },
  ],
  [
    "mtop.aliexpress.search.product.search",
    "1.0",
    {
      q: "airpods",
      page: 1,
      pageSize: 20,
      shipToCountry: "GB",
      currency: "GBP",
    },
  ],
];

for (const [api, version, data] of attempts) {
  const res = await callMtop(api, version, data, cookies);
  const text = JSON.stringify(res);
  const hasAirpod = /airpod/i.test(text);
  console.log("\n", api, "ret", res.ret?.[0], "hasAirpod", hasAirpod, "len", text.length);
  if (hasAirpod) console.log(text.slice(0, 1200));
}
