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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAppBaseUrl() {
  const data = await chrome.storage.local.get(STORAGE.appBaseUrl);
  return data[STORAGE.appBaseUrl] || "http://localhost:3000";
}

async function notifyAppPages(payload) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id == null) continue;
    try {
      await chrome.tabs.sendMessage(tab.id, payload);
    } catch {
      // Tab has no bridge content script.
    }
  }
}

async function postResults(userId, keyword, products) {
  const base = await getAppBaseUrl();
  const soldPrices = products.map((p) => Number(p.soldPrice) || 0).filter((n) => n > 0);
  const totalSold = products.reduce((sum, p) => sum + (Number(p.soldCount) || 0), 0);
  const avgPrice =
    soldPrices.length > 0 ? soldPrices.reduce((a, b) => a + b, 0) / soldPrices.length : 0;

  const url = `${base.replace(/\/$/, "")}/api/hunting/receive`;
  const response = await fetch(url, {
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
    throw new Error(`Receive API ${response.status}: ${text || "failed"} (POST ${url})`);
  }

  return response.json();
}

/** In-page scraper injected via chrome.scripting when content-script messaging fails. */
function pageScrapeFunction() {
  function parsePrice(text) {
    if (!text) return 0;
    const match = String(text).replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
    return match ? Number(match[1]) : 0;
  }

  function parseSoldCount(text) {
    if (!text) return 0;
    const cleaned = String(text).toLowerCase().replace(/,/g, "");
    const match = cleaned.match(/([\d.]+)\s*(k)?\+?\s*sold/);
    if (!match) return 0;
    const n = Number(match[1]);
    return match[2] ? Math.round(n * 1000) : Math.round(n);
  }

  function itemIdFromUrl(url) {
    const match = String(url).match(/\/itm\/(?:[^/]+\/)?(\d{9,})/);
    return match ? match[1] : "";
  }

  const products = [];
  const cards = document.querySelectorAll(
    "li.s-item, .s-item, li[data-viewport], .srp-results li, ul.srp-results > li",
  );

  cards.forEach((card) => {
    const linkEl =
      card.querySelector("a.s-item__link") ||
      card.querySelector('a[href*="/itm/"]');
    const titleEl =
      card.querySelector(".s-item__title span[role='heading']") ||
      card.querySelector(".s-item__title") ||
      card.querySelector("h3");
    const priceEl = card.querySelector(".s-item__price") || card.querySelector("[class*='price']");
    const imageEl = card.querySelector("img");
    const listingUrl = linkEl?.href || "";
    if (!listingUrl.includes("/itm/")) return;

    const title = (titleEl?.textContent || "").replace(/New Listing/gi, "").trim();
    if (!title || /shop on ebay/i.test(title)) return;

    products.push({
      title,
      soldPrice: parsePrice(priceEl?.textContent || ""),
      soldDate: "",
      imageUrl: imageEl?.src || "",
      itemId: itemIdFromUrl(listingUrl),
      condition: "New",
      shippingCost: 0,
      totalPrice: parsePrice(priceEl?.textContent || ""),
      listingUrl: listingUrl.split("?")[0],
      soldCount: parseSoldCount(card.textContent || ""),
      daysWindow: 7,
      listedDate: "",
    });
  });

  return products;
}

async function scrapeTab(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "HUNTPRO_SCRAPE_PAGE" });
    if (Array.isArray(response?.products) && response.products.length > 0) {
      return response.products;
    }
  } catch {
    // Fall through to executeScript.
  }

  try {
    const injected = await chrome.scripting.executeScript({
      target: { tabId },
      func: pageScrapeFunction,
    });
    const products = injected?.[0]?.result;
    return Array.isArray(products) ? products : [];
  } catch {
    return [];
  }
}

async function waitForTabComplete(tabId, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === "complete") return;
    } catch {
      return;
    }
    await wait(400);
  }
}

async function openAndScrape(url) {
  const tab = await chrome.tabs.create({ url, active: false });
  if (tab.id == null) return [];

  await waitForTabComplete(tab.id);
  await wait(2000);

  let products = await scrapeTab(tab.id);
  if (products.length === 0) {
    await wait(2500);
    products = await scrapeTab(tab.id);
  }

  try {
    await chrome.tabs.remove(tab.id);
  } catch {
    // Tab may already be closed.
  }

  return products;
}

function normalizeProduct(raw, lookbackDays) {
  return {
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
}

async function runRandomHunt(payload) {
  const userId = payload.userId;
  if (!userId) return { ok: false, error: "Missing userId." };

  const targetCount = Math.min(Math.max(Number(payload.targetCount) || 20, 5), 40);
  const lookbackDays = Number(payload.lookbackDays) || 7;

  await chrome.storage.local.set({
    [STORAGE.userId]: userId,
    [STORAGE.activeHunt]: { startedAt: Date.now(), targetCount, status: "running" },
  });

  if (payload.appBaseUrl) {
    await chrome.storage.local.set({ [STORAGE.appBaseUrl]: payload.appBaseUrl });
  }

  await notifyAppPages({
    type: "HUNTPRO_STATUS",
    status: "running",
    message: "Opening eBay sold searches…",
  });

  // Fewer keywords = faster first result; still random.
  const keywords = pickRandomKeywords(5);
  const byItemId = new Map();
  const deadline = Date.now() + 90_000;

  for (let i = 0; i < keywords.length; i += 1) {
    if (byItemId.size >= targetCount || Date.now() > deadline) break;

    const keyword = keywords[i];
    await notifyAppPages({
      type: "HUNTPRO_STATUS",
      status: "running",
      message: `Scanning “${keyword}” (${i + 1}/${keywords.length})…`,
    });

    const scraped = await openAndScrape(ebaySoldSearchUrl(keyword));
    for (const raw of scraped) {
      const product = normalizeProduct(raw, lookbackDays);
      // Sold-search pages are already completed sales — keep any real listing.
      if (!product.title || !product.listingUrl) continue;
      const key = product.itemId || product.listingUrl;
      if (!byItemId.has(key)) byItemId.set(key, product);
      if (byItemId.size >= targetCount) break;
    }
  }

  const products = [...byItemId.values()]
    .sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
    .slice(0, targetCount);

  await chrome.storage.local.set({
    [STORAGE.activeHunt]: {
      startedAt: Date.now(),
      targetCount,
      status: products.length > 0 ? "done" : "empty",
      productCount: products.length,
    },
  });

  if (products.length === 0) {
    const error = "No products scraped from eBay. Sign into eBay in Chrome, then try again.";
    await notifyAppPages({ type: "HUNTPRO_ERROR", error });
    return { ok: false, error };
  }

  await notifyAppPages({
    type: "HUNTPRO_STATUS",
    status: "saving",
    message: `Saving ${products.length} products to EcomTool…`,
  });

  await postResults(userId, payload.keyword || "random-hot", products);
  await notifyAppPages({
    type: "HUNTPRO_RESULTS",
    productCount: products.length,
    keyword: payload.keyword || "random-hot",
  });

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

  await notifyAppPages({
    type: "HUNTPRO_STATUS",
    status: "running",
    message: `Searching eBay for “${keyword}”…`,
  });

  const days = Number(payload.days) || 7;
  const scraped = await openAndScrape(ebaySoldSearchUrl(keyword));
  const products = scraped
    .map((raw) => normalizeProduct(raw, days))
    .filter((p) => p.title && p.listingUrl)
    .slice(0, 30);

  if (products.length === 0) {
    const error = "No sold listings found for that keyword.";
    await notifyAppPages({ type: "HUNTPRO_ERROR", error });
    return { ok: false, error };
  }

  await postResults(userId, keyword, products);
  await notifyAppPages({
    type: "HUNTPRO_RESULTS",
    productCount: products.length,
    keyword,
  });
  return { ok: true, productCount: products.length };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const type = message?.type;

  if (type === "HUNTPRO_CONNECT") {
    void (async () => {
      if (message.userId) await chrome.storage.local.set({ [STORAGE.userId]: message.userId });
      if (message.appBaseUrl) {
        await chrome.storage.local.set({ [STORAGE.appBaseUrl]: message.appBaseUrl });
      }
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (type === "HUNTPRO_PING") {
    sendResponse({ ok: true, extension: "huntpro", version: "1.0.2" });
    return false;
  }

  // ACK immediately — long scrapes must NOT hold the message port open (MV3 kills it).
  if (type === "HUNTPRO_RANDOM_HUNT") {
    sendResponse({ ok: true, started: true });
    void runRandomHunt(message).catch(async (error) => {
      await notifyAppPages({
        type: "HUNTPRO_ERROR",
        error: error instanceof Error ? error.message : "Random hunt failed.",
      });
    });
    return false;
  }

  if (type === "HUNTPRO_SEARCH") {
    sendResponse({ ok: true, started: true });
    void runKeywordSearch(message).catch(async (error) => {
      await notifyAppPages({
        type: "HUNTPRO_ERROR",
        error: error instanceof Error ? error.message : "Keyword hunt failed.",
      });
    });
    return false;
  }

  sendResponse({ ok: false, error: "Unknown message." });
  return false;
});
