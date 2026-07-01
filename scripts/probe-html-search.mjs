import { loadEnv } from "./load-env.mjs";

loadEnv();

const url =
  "https://www.aliexpress.com/w/wholesale-airpods.html?SearchText=airpods&shipFromCountry=GB&minPrice=0.99&maxPrice=5&sortType=total_tranpro_desc&page=1&g=y";

const response = await fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-GB,en;q=0.9",
  },
});

const html = await response.text();
console.log("status", response.status, "len", html.length);
console.log("airpod mentions", (html.match(/airpod/gi) ?? []).length);

const productIds = [...html.matchAll(/"productId":"(\d+)"/g)].map((m) => m[1]);
console.log("productIds", productIds.length, productIds.slice(0, 5));

const titles = [...html.matchAll(/"title":"([^"]{10,120})"/g)]
  .map((m) => m[1])
  .filter((t) => /airpod|earbud|earphone|headphone/i.test(t));
console.log("relevant titles", titles.slice(0, 8));
