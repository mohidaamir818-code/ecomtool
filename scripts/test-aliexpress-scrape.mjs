const url = process.argv[2] || "https://www.aliexpress.com/item/1005006123456789.html";

const res = await fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-GB,en;q=0.9",
  },
});

const html = await res.text();
console.log("status", res.status, "len", html.length);

const patterns = [
  ["og:title", /property="og:title"\s+content="([^"]+)"/i],
  ["og:image", /property="og:image"\s+content="([^"]+)"/i],
  ["title tag", /<title>([^<]+)<\/title>/i],
  ["formattedPrice", /"formattedPrice"\s*:\s*"([^"]+)"/],
  ["minPrice", /"minPrice"\s*:\s*"([^"]+)"/],
  ["minActivityAmount", /"minActivityAmount"\s*:\s*\{[^}]*"value"\s*:\s*([0-9.]+)/],
  ["productTitle", /"subject"\s*:\s*"([^"]+)"/],
  ["totalAvailQuantity", /"totalAvailQuantity"\s*:\s*(\d+)/],
  ["skuAvailQuantity", /"skuAvailQuantity"\s*:\s*(\d+)/],
];

for (const [name, regex] of patterns) {
  const m = html.match(regex);
  if (m) console.log(name, m[1].slice(0, 120));
}

const scriptData = html.match(/data:\s*(\{[\s\S]{200,8000}?\})\s*,\s*csrfToken/);
if (scriptData) console.log("data block", scriptData[1].slice(0, 400));
