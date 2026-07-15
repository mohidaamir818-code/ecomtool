(function () {
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

  function scrapeSearchResults() {
    const products = [];
    const cards = document.querySelectorAll(
      "li.s-item, .s-item, li[data-viewport], .srp-results li, ul.srp-results > li",
    );

    cards.forEach((card) => {
      const linkEl =
        card.querySelector("a.s-item__link") || card.querySelector('a[href*="/itm/"]');
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
        imageUrl: imageEl?.src || imageEl?.getAttribute("data-src") || "",
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

  function scrapeListingPage() {
    const title =
      document
        .querySelector("h1.x-item-title__mainTitle span, h1[class*='title']")
        ?.textContent?.trim() || document.title.replace(/\s*\|\s*eBay.*$/i, "").trim();
    const priceText =
      document.querySelector(
        "[data-testid='x-price-primary'] span, .x-price-primary span, #prcIsum",
      )?.textContent || "";
    const soldText = document.body.innerText || "";
    const imageUrl =
      document.querySelector("img[data-zoom-src], .ux-image-carousel img, #icImg")?.src || "";
    const listingUrl = window.location.href.split("?")[0];

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
        soldCount: parseSoldCount(soldText),
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
