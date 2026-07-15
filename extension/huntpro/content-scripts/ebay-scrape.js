(function () {
  function parsePrice(text) {
    if (!text) return 0;
    const match = String(text).replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
    return match ? Number(match[1]) : 0;
  }

  function parseSoldCount(text) {
    if (!text) return 0;
    const cleaned = String(text).toLowerCase();
    const match = cleaned.replace(/,/g, "").match(/([\d.]+)\s*(k)?\s*sold/);
    if (!match) {
      const qty = cleaned.match(/([\d.]+)\s*(k)?\+/);
      if (!qty) return 0;
      const n = Number(qty[1]);
      return qty[2] ? Math.round(n * 1000) : Math.round(n);
    }
    const n = Number(match[1]);
    return match[2] ? Math.round(n * 1000) : Math.round(n);
  }

  function itemIdFromUrl(url) {
    try {
      const match = String(url).match(/\/itm\/(?:[^/]+\/)?(\d{9,})/);
      return match ? match[1] : "";
    } catch {
      return "";
    }
  }

  function scrapeSearchResults() {
    const products = [];
    const cards = document.querySelectorAll(
      ".s-item, li[data-viewport], .su-card-container, .srp-results .s-card",
    );

    cards.forEach((card) => {
      const linkEl =
        card.querySelector("a.s-item__link") ||
        card.querySelector("a.s-card__link") ||
        card.querySelector('a[href*="/itm/"]');
      const titleEl =
        card.querySelector(".s-item__title") ||
        card.querySelector(".s-card__title") ||
        card.querySelector("h3, .su-styled-text");
      const priceEl =
        card.querySelector(".s-item__price") ||
        card.querySelector(".s-card__price") ||
        card.querySelector('[class*="price"]');
      const imageEl = card.querySelector("img");
      const metaText = card.textContent || "";

      const listingUrl = linkEl?.href || "";
      if (!listingUrl.includes("/itm/")) return;

      const title = (titleEl?.textContent || "").replace(/Shop on eBay/i, "").trim();
      if (!title || /shop on ebay/i.test(title)) return;

      const soldCount = parseSoldCount(metaText);
      products.push({
        title,
        soldPrice: parsePrice(priceEl?.textContent || ""),
        soldDate: "",
        imageUrl: imageEl?.src || imageEl?.getAttribute("data-src") || "",
        itemId: itemIdFromUrl(listingUrl),
        condition: "New",
        shippingCost: 0,
        totalPrice: parsePrice(priceEl?.textContent || ""),
        listingUrl: listingUrl.split("?")[0],
        soldCount,
        daysWindow: 7,
        listedDate: "",
      });
    });

    return products;
  }

  function scrapeListingPage() {
    const title =
      document.querySelector("h1.x-item-title__mainTitle span, h1[class*='title']")?.textContent?.trim() ||
      document.title.replace(/\s*\|\s*eBay.*$/i, "").trim();
    const priceText =
      document.querySelector("[data-testid='x-price-primary'] span, .x-price-primary span, #prcIsum")
        ?.textContent || "";
    const soldText =
      document.querySelector(".x-item-quantity__sold, [class*='sold']")?.textContent ||
      document.body.innerText;
    const imageUrl =
      document.querySelector("img[data-zoom-src], .ux-image-carousel img, #icImg")?.src || "";
    const listingUrl = window.location.href.split("?")[0];
    const soldCount = parseSoldCount(soldText);

    // Prefer Grabley’s [history] cue when present (sold history available).
    const hasHistory = Boolean(
      document.querySelector('a[href*="Offer.ListingDetails"]') ||
        Array.from(document.querySelectorAll("a, button, span")).some((el) =>
          /\[?\s*history\s*\]?/i.test(el.textContent || ""),
        ),
    );

    if (!title) return [];

    return [
      {
        title,
        soldPrice: parsePrice(priceText),
        soldDate: "",
        imageUrl,
        itemId: itemIdFromUrl(listingUrl),
        condition: "New",
        shippingCost: 0,
        totalPrice: parsePrice(priceText),
        listingUrl,
        soldCount: soldCount || (hasHistory ? 8 : 0),
        daysWindow: 7,
        listedDate: "",
      },
    ];
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "HUNTPRO_SCRAPE_PAGE") return;

    try {
      const isItem = /\/itm\//.test(window.location.pathname);
      const products = isItem ? scrapeListingPage() : scrapeSearchResults();
      sendResponse({ ok: true, products });
    } catch (error) {
      sendResponse({
        ok: false,
        products: [],
        error: error instanceof Error ? error.message : "Scrape failed",
      });
    }

    return true;
  });
})();
