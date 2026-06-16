import crypto from "crypto";

const MTOP_APP_KEY = "12574478";
const MTOP_HOST = "https://acs.aliexpress.com";

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
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function bootstrapMtopCookies() {
  const cookies = {};
  const bootstrapUrl = `${MTOP_HOST}/h5/mtop.aliexpress.pdp.pc.query/1.0/?jsv=2.5.1&appKey=${MTOP_APP_KEY}&t=${Date.now()}&sign=abc123&api=mtop.aliexpress.pdp.pc.query&v=1.0&type=originaljsonp&dataType=originaljsonp&callback=mtopjsonp1&data=${encodeURIComponent("{}")}`;

  const response = await fetch(bootstrapUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://www.aliexpress.com/",
    },
    redirect: "follow",
  });

  const raw = response.headers.getSetCookie?.() ?? [];
  Object.assign(cookies, parseCookies(raw));

  return cookies;
}

function buildMtopSign(token, timestamp, data) {
  return md5(`${token}&${timestamp}&${MTOP_APP_KEY}&${data}`);
}

async function callMtopProductDetail(productId, cookies) {
  const token = (cookies._m_h5_tk ?? "").split("_")[0];
  if (!token) throw new Error("Could not obtain AliExpress session token.");

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
  const sign = buildMtopSign(token, timestamp, data);

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
    }).toString();

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: `https://www.aliexpress.com/item/${productId}.html`,
      Cookie: cookieHeader(cookies),
    },
  });

  const text = await response.text();
  const jsonMatch = text.match(/mtopjsonp1\(([\s\S]*)\)/);
  if (!jsonMatch) {
    console.log("Raw:", text.slice(0, 500));
    throw new Error("Unexpected MTOP response.");
  }

  return JSON.parse(jsonMatch[1]);
}

const productId = process.argv[2] ?? "1005005095908799";
console.log("Product:", productId);

let cookies = await bootstrapMtopCookies();
console.log("Cookies:", Object.keys(cookies));

let payload = await callMtopProductDetail(productId, cookies);
console.log("ret:", payload.ret);

if (payload.ret?.some((r) => r.includes("TOKEN"))) {
  const raw = payload.ret.join(",");
  if (raw.includes("TOKEN_EXOIRED") || raw.includes("TOKEN_EMPTY") || raw.includes("ILLEGAL_ACCESS")) {
    cookies = await bootstrapMtopCookies();
    payload = await callMtopProductDetail(productId, cookies);
    console.log("retry ret:", payload.ret);
  }
}

const result = payload.data?.result ?? payload.data;
console.log("keys:", result ? Object.keys(result) : "none");

if (result) {
  console.log("title:", result.titleModule?.subject ?? result.ITEM_TITLE ?? result.subject);
  console.log("price:", result.priceModule?.minAmount ?? result.priceModule?.formatedActivityPrice);
  console.log("orders:", result.tradeModule?.tradeCount ?? result.feedbackModule?.tradeCount);
  console.log("image:", result.imageModule?.imagePathList?.[0] ?? result.imageModule?.imageUrlList?.[0]);
}

console.log("\nFull data sample:", JSON.stringify(result ?? payload, null, 2).slice(0, 3000));
