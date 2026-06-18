import fs from "fs";

const productId = process.argv[2] ?? "1005011923896571";
const r = await fetch(`https://www.aliexpress.com/item/${productId}.html`, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-GB,en;q=0.9",
  },
});
const html = await r.text();
fs.writeFileSync("scripts/tmp-ae-page.html", html);

const needles = [
  "sold",
  "trade",
  "order",
  "sales_count",
  "salesCount",
  "tradeCount",
  "otherText",
  "volume",
  "INIT_DATA",
  "runParams",
  "__INIT",
  "pdp",
  "mtop",
  "aer",
  "14 sold",
  "13 sold",
];
for (const n of needles) {
  const idx = html.indexOf(n);
  console.log(n, idx >= 0 ? `found@${idx} ctx=${html.slice(Math.max(0, idx - 40), idx + 80).replace(/\s+/g, " ")}` : "missing");
}

const jsonBlocks = [...html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)];
console.log("json script blocks:", jsonBlocks.length);
for (const [, block] of jsonBlocks.slice(0, 5)) {
  if (/sold|trade|order|sales/i.test(block)) {
    console.log("json block:", block.slice(0, 500));
  }
}
