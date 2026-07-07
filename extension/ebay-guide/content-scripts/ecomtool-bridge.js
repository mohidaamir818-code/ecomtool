(function () {
  const SOURCE = "ebay-guide-extension";

  function relayToBackground(payload) {
    try {
      chrome.runtime.sendMessage(payload, () => {
        void chrome.runtime.lastError;
      });
    } catch {
      // Extension context may be invalidated.
    }
  }

  function postToPage(data) {
    try {
      window.postMessage({ ...data, source: SOURCE }, "*");
    } catch {
      // Ignore.
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "ECOMTOOL_EBAY_GUIDE_PING" && data.source === "ecomtool") {
      postToPage({ type: "ECOMTOOL_EBAY_GUIDE_PONG" });
      return;
    }

    if (data.type === "ECOMTOOL_EBAY_GUIDE_START" && data.source === "ecomtool") {
      relayToBackground({
        type: "EBAY_GUIDE_START",
        guideId: data.guideId || "hunting-basics",
        userId: data.userId || null,
      });
      return;
    }

    if (data.type === "ECOMTOOL_EBAY_GUIDE_CONNECT") {
      const userId = data.userId || document.documentElement.getAttribute("data-ecomtool-user-id");
      if (userId) {
        relayToBackground({ type: "EBAY_GUIDE_CONNECT", userId });
        postToPage({ type: "ECOMTOOL_EBAY_GUIDE_CONNECTED", userId });
      }
    }
  });

  // Announce presence so the app can detect the extension without a ping round-trip.
  postToPage({ type: "ECOMTOOL_EBAY_GUIDE_PONG", ready: true });
})();
