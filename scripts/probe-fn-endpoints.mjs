const productId = process.argv[2] ?? "1005011923896571";
const pageNames = ["pdp-pc", "pdp", "product-detail", "item-detail", "detail-pc"];

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: `https://www.aliexpress.com/item/${productId}.html`,
  Accept: "application/json, text/plain, */*",
};

for (const page of pageNames) {
  const url = `https://www.aliexpress.com/fn/${page}/index`;
  const r = await fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ productId, pageVersion: "0.2.131", country: "GB", currency: "GBP" }),
  });
  const text = await r.text();
  console.log(page, r.status, text.slice(0, 300));
  if (/tradeCount|sales_count|otherText|sold/i.test(text)) {
    console.log("HIT", text.match(/(tradeCount|sales_count|otherText)[^,}\n]{0,50}/gi));
  }
}
