const productId = process.argv[2] ?? "1005011923896571";
const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-GB,en;q=0.9",
  Referer: `https://www.aliexpress.com/item/${productId}.html`,
};

const endpoints = [
  `https://www.aliexpress.com/aeglodetailweb/api/query?productId=${productId}&country=GB&currency=GBP&locale=en_GB`,
  `https://www.aliexpress.com/aeglodetailweb/api/query/product?productId=${productId}`,
  `https://www.aliexpress.com/fn/search-pc/index?productId=${productId}`,
  `https://feedback.aliexpress.com/pc/searchEvaluationProduct.do?productId=${productId}&lang=en_US&country=GB&page=1&pageSize=1&filter=all&sort=complex_default`,
];

for (const url of endpoints) {
  try {
    const r = await fetch(url, { headers, redirect: "follow" });
    const text = await r.text();
    console.log("\n===", url.slice(0, 90), "===");
    console.log("status", r.status, "len", text.length);
    const soldHits = [...text.matchAll(/(tradeCount|sales_count|salesCount|otherText|orderCount|sold|volume)[^,}\n]{0,40}/gi)].map(
      (m) => m[0],
    );
    if (soldHits.length) console.log("hits:", [...new Set(soldHits)].slice(0, 10));
    else console.log("sample:", text.slice(0, 400));
  } catch (e) {
    console.log(url, e.message);
  }
}
