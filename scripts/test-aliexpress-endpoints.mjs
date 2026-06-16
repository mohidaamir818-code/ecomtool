const productId = process.argv[2] ?? "1005005095908799";

const endpoints = [
  `https://m.aliexpress.com/api/product/detail?productId=${productId}&country=GB`,
  `https://m.aliexpress.com/api/product/detail?productId=${productId}&country=US`,
  `https://www.aliexpress.com/aeglobal/default/detail/v2?productId=${productId}&country=GB&locale=en_GB`,
  `https://acs.aliexpress.com/h5/mtop.aliexpress.pdp.pc.query/1.0/?data=${encodeURIComponent(JSON.stringify({ productId, _lang: "en_GB", _currency: "GBP", country: "GB", province: "", city: "", clientType: "pc", ext: JSON.stringify({ foreverRandomToken: "test" }) }))}`,
];

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-GB,en;q=0.9",
  Referer: `https://www.aliexpress.com/item/${productId}.html`,
};

for (const url of endpoints) {
  console.log("\n===", url.slice(0, 100), "...");
  try {
    const r = await fetch(url, { headers, redirect: "follow" });
    const text = await r.text();
    console.log("status:", r.status, "len:", text.length);
    console.log(text.slice(0, 1500));
  } catch (e) {
    console.log("error:", e.message);
  }
}
