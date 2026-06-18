const productId = process.argv[2] ?? "1005011923896571";
const endpoints = [
  `https://feedback.aliexpress.com/pc/searchEvaluationProduct.do?productId=${productId}&lang=en_US&country=GB&page=1&pageSize=10&filter=all&sort=complex_default`,
  `https://feedback.aliexpress.com/display/productEvaluation.htm?productId=${productId}&ownerMemberId=0`,
  `https://www.aliexpress.com/aeglodetailweb/api/review/query?productId=${productId}`,
  `https://www.aliexpress.com/aer-api/v1/review/query?productId=${productId}`,
];

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: `https://www.aliexpress.com/item/${productId}.html`,
  Accept: "application/json, text/plain, */*",
};

for (const url of endpoints) {
  try {
    const r = await fetch(url, { headers });
    const ct = r.headers.get("content-type") ?? "";
    const text = await r.text();
    console.log("\n", url.split("?")[0].split("/").slice(-2).join("/"), r.status, ct.split(";")[0]);
    if (ct.includes("json")) {
      console.log(text.slice(0, 1000));
    } else {
      const sold = [...text.matchAll(/(\d[\d,]*)\s*(sold|orders)/gi)].map((m) => m[0]);
      const trade = text.match(/tradeCount|sales_count|totalTrade|orderCount/gi);
      console.log("sold text", sold.slice(0, 5), "keys", trade?.slice(0, 5));
    }
  } catch (e) {
    console.log(url, e.message);
  }
}
