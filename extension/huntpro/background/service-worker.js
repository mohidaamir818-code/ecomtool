/** Random seed keywords for hot-product discovery on eBay UK. */
const RANDOM_KEYWORDS = [
  "phone case",
  "led lights",
  "car organiser",
  "kitchen gadget",
  "wireless charger",
  "bluetooth speaker",
  "pet toy",
  "makeup organiser",
  "camping light",
  "hair clip",
  "desk organiser",
  "usb cable",
  "plant pot",
  "tool set",
  "baby bib",
  "yoga mat",
  "key finder",
  "shower head",
  "wall clock",
  "laptop stand",
];

const HUNTPRO_KEY = "huntpro-secret-2026";
const STORAGE = {
  userId: "huntpro_user_id",
  appBaseUrl: "huntpro_app_base_url",
  activeHunt: "huntpro_active_hunt",
};

function ebaySoldSearchUrl(keyword) {
  const q = encodeURIComponent(keyword);
  return `https://www.ebay.co.uk/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1&rt=nc&_ipg=60`;
}

function pickRandomKeywords(count) {
  const pool = [...RANDOM_KEYWORDS];
  const picked = [];
  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

async function getAppBaseUrl() {
  const data = await chrome.storage.local.get(STORAGE.appBaseUrl);
  return data[STORAGE.appBaseUrl] || "http://localhost:3000";
}

async function postResults(userId, keyword, products) {
  const base = await getAppBaseUrl();
  const soldPrices = products.map((p) => Number(p.soldPrice) || 0).filter((n) => n > 0);
  const totalSold = products.reduce((sum, p) => sum + (Number(p.soldCount) || 0), 0);
  const avgPrice =
    soldPrices.length > 0
      ? soldPrices.reduce((a, b) => a + b, 0) / soldPrices.length
      : 0;

  const response = await fetch(`${base.replace(/\/$/, "")}/api/hunting/receive`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-huntpro-key": HUNTPRO_KEY,
    },
    body: JSON.stringify({
      userId,
      keyword: keyword || "random-hot",
      source: "huntpro-extension",
      timestamp: Date.now(),
      huntComplete: true,
      statistics: {
        totalSold,
        avgPrice: Number(avgPrice.toFixed(2)),
        minPrice: soldPrices.length ? Math.min(...soldPrices) : 0,
        maxPrice: soldPrices.length ? Math.max(...soldPrices) : 0,
        totalRevenue: Number(
          products
            .reduce((sum, p) => sum + (Number(p.soldPrice) || 0) * (Number(p.soldCount) || 1), 0)
            .toFixed(2),
        ),
        dailyAverage: Number((totalSold / 7).toFixed(2)),
      },
      products,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Receive API failed (${response.status})`);
  }

  return response.json();
}

async function scrapeTab(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "HUNTPRO_SCRAPE_PAGE" });
    return Array.isArray(response?.products) ? response.products : [];
  } catch {
    return [];
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openAndScrape(url) {
  const tab = await chrome.tabs.create({ url, active: false });
  if (tab.id == null) return [];

  // Wait for eBay + content script to settle.
  await wait(4500);
  let products = await scrapeTab(tab.id);

  // One retry if the page was still loading.
  if (products.length === 0) {
    await wait(3500);
    products = await scrapeTab(tab.id);
  }

  try {
    await chrome.tabs.remove(tab.id);
  } catch {
    // Tab may already be closed.
  }

  return products;
}

function passesHotFilter(product, minDailySales) {
  const soldCount = Number(product.soldCount) || 0;
  const daysWindow = Number(product.daysWindow) || 7;
  const daily = soldCount / Math.max(1, daysWindow);
  // Prefer items with clear velocity; still keep strong total solds.
  return daily >= minDailySales || soldCount >= Math.max(7, minDailySales * 7);
}

async function runRandomHunt(payload) {
  const userId = payload.userId;
  if (!userId) return { ok: false, error: "Missing userId." };

  const targetCount = Math.min(Math.max(Number(payload.targetCount) || 20, 5), 40);
  const minDailySales = Number(payload.minDailySales) || 1;
  const lookbackDays = Number(payload.lookbackDays) || 7;

  await chrome.storage.local.set({
    [STORAGE.userId]: userId,
    [STORAGE.activeHunt]: {
      startedAt: Date.now(),
      targetCount,
      status: "running",
    },
  });

  if (payload.appBaseUrl) {
    await chrome.storage.local.set({ [STORAGE.appBaseUrl]: payload.appBaseUrl });
  }

  const keywords = pickRandomKeywords(8);
  const byItemId = new Map();

  for (const keyword of keywords) {
    if (byItemId.size >= targetCount) break;

    const url = ebaySoldSearchUrl(keyword);
    const scraped = await openAndScrape(url);

    for (const raw of scraped) {
      const product = {
        title: String(raw.title || "").trim(),
        soldPrice: Number(raw.soldPrice) || 0,
        soldDate: String(raw.soldDate || ""),
        imageUrl: String(raw.imageUrl || ""),
        itemId: String(raw.itemId || raw.listingUrl || raw.title || ""),
        condition: String(raw.condition || "New"),
        shippingCost: Number(raw.shippingCost) || 0,
        totalPrice: Number(raw.totalPrice) || Number(raw.soldPrice) || 0,
        listingUrl: String(raw.listingUrl || ""),
        soldCount: Number(raw.soldCount) || 0,
        daysWindow: Number(raw.daysWindow) || lookbackDays,
        listedDate: String(raw.listedDate || ""),
      };

      if (!product.title || !product.listingUrl) continue;
      if (!passesHotFilter(product, minDailySales)) continue;

      const key = product.itemId || product.listingUrl;
      if (!byItemId.has(key)) byItemId.set(key, product);
      if (byItemId.size >= targetCount) break;
    }
  }

  const products = [...byItemId.values()].slice(0, targetCount);
  await chrome.storage.local.set({
    [STORAGE.activeHunt]: {
      startedAt: Date.now(),
      targetCount,
      status: products.length > 0 ? "done" : "empty",
      productCount: products.length,
    },
  });

  if (products.length === 0) {
    return { ok: false, error: "No hot products found on this pass. Try again." };
  }

  await postResults(userId, payload.keyword || "random-hot", products);
  return { ok: true, productCount: products.length };
}

async function runKeywordSearch(payload) {
  const userId = payload.userId;
  const keyword = String(payload.keyword || "").trim();
  if (!userId || keyword.length < 2) {
    return { ok: false, error: "userId and keyword required." };
  }

  if (payload.appBaseUrl) {
    await chrome.storage.local.set({ [STORAGE.appBaseUrl]: payload.appBaseUrl });
  }

  const days = Number(payload.days) || 7;
  const scraped = await openAndScrape(ebaySoldSearchUrl(keyword));
  const products = scraped
    .map((raw) => ({
      title: String(raw.title || "").trim(),
      soldPrice: Number(raw.soldPrice) || 0,
      soldDate: String(raw.soldDate || ""),
      imageUrl: String(raw.imageUrl || ""),
      itemId: String(raw.itemId || raw.listingUrl || ""),
      condition: String(raw.condition || "New"),
      shippingCost: Number(raw.shippingCost) || 0,
      totalPrice: Number(raw.totalPrice) || Number(raw.soldPrice) || 0,
      listingUrl: String(raw.listingUrl || ""),
      soldCount: Number(raw.soldCount) || 0,
      daysWindow: days,
      listedDate: String(raw.listedDate || ""),
    }))
    .filter((p) => p.title && p.listingUrl)
    .slice(0, 30);

  if (products.length === 0) {
    return { ok: false, error: "No sold listings found for that keyword." };
  }

  await postResults(userId, keyword, products);
  return { ok: true, productCount: products.length };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    try {
      if (message?.type === "HUNTPRO_CONNECT") {
        if (message.userId) {
          await chrome.storage.local.set({ [STORAGE.userId]: message.userId });
        }
        if (message.appBaseUrl) {
          await chrome.storage.local.set({ [STORAGE.appBaseUrl]: message.appBaseUrl });
        }
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === "HUNTPRO_PING") {
        sendResponse({ ok: true, extension: "huntpro" });
        return;
      }

      if (message?.type === "HUNTPRO_RANDOM_HUNT") {
        const result = await runRandomHunt(message);
        sendResponse(result);
        return;
      }

      if (message?.type === "HUNTPRO_SEARCH") {
        const result = await runKeywordSearch(message);
        sendResponse(result);
        return;
      }

      sendResponse({ ok: false, error: "Unknown message." });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "HuntPro failed.",
      });
    }
  })();

  return true;
});
