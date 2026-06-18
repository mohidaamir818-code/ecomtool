const id = process.argv[2] ?? "1005011923896571";
const urls = [
  `https://www.aliexpress.com/item/${id}.html`,
  `https://m.aliexpress.com/item/${id}.html`,
  `https://www.aliexpress.us/item/${id}.html`,
];

for (const url of urls) {
  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      "Accept-Language": "en-GB,en;q=0.9",
    },
  });
  const t = await r.text();
  const sold = [...t.matchAll(/(\d[\d,]*)\s*sold/gi)].map((m) => m[0]);
  console.log(
    url.split("/")[2],
    "len",
    t.length,
    "sold",
    sold.slice(0, 5),
    "has tradeCount",
    t.includes("tradeCount"),
    "has sales_count",
    t.includes("sales_count"),
  );
}
