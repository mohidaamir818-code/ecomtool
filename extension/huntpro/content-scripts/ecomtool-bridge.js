(function () {
  const SOURCE = "huntpro-extension";

  function markPresent() {
    try {
      document.documentElement.setAttribute("data-ecomtool-huntpro", "ready");
      document.documentElement.dataset.ecomtoolHuntpro = "ready";
    } catch {
      // Ignore.
    }
    try {
      window.dispatchEvent(
        new CustomEvent("ecomtool-huntpro-pong", { detail: { ready: true, source: SOURCE } }),
      );
    } catch {
      // Ignore.
    }
  }

  function postToPage(data) {
    try {
      window.postMessage({ ...data, source: SOURCE }, "*");
    } catch {
      // Ignore.
    }
  }

  function replyPong() {
    markPresent();
    postToPage({ type: "HUNTPRO_PONG", ready: true, source: SOURCE });
  }

  function relayToBackground(payload, respondToPage) {
    try {
      chrome.runtime.sendMessage(payload, (response) => {
        const err = chrome.runtime.lastError;
        if (err) {
          if (typeof respondToPage === "function") {
            respondToPage({ ok: false, error: err.message || "HuntPro background unavailable." });
          }
          return;
        }
        if (typeof respondToPage === "function") {
          respondToPage(response || { ok: true, started: true });
        }
      });
    } catch (error) {
      if (typeof respondToPage === "function") {
        respondToPage({
          ok: false,
          error: error instanceof Error ? error.message : "HuntPro extension context invalid.",
        });
      }
    }
  }

  // Background → page notifications (results / errors / status).
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") return;
    if (
      message.type === "HUNTPRO_RESULTS" ||
      message.type === "HUNTPRO_ERROR" ||
      message.type === "HUNTPRO_STATUS"
    ) {
      postToPage(message);
    }
  });

  window.addEventListener("message", (event) => {
    if (event.source && event.source !== window) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "HUNTPRO_PING") {
      replyPong();
      return;
    }

    if (data.type === "ECOMTOOL_HUNTPRO_CONNECT") {
      const userId =
        data.userId || document.documentElement.getAttribute("data-ecomtool-user-id");
      relayToBackground(
        {
          type: "HUNTPRO_CONNECT",
          userId,
          appBaseUrl: window.location.origin,
        },
        () => {
          postToPage({ type: "ECOMTOOL_HUNTPRO_CONNECT", userId, connected: true });
        },
      );
      return;
    }

    if (
      data.type === "HUNTPRO_RANDOM_HUNT" &&
      (data.source === "ecomtool" || data.source === "huntpro-extension" || !data.source)
    ) {
      postToPage({ type: "HUNTPRO_STATUS", status: "started", message: "HuntPro received start signal…" });
      relayToBackground(
        {
          type: "HUNTPRO_RANDOM_HUNT",
          userId: data.userId,
          keyword: data.keyword || "random-hot",
          targetCount: data.targetCount || 20,
          minDailySales: data.minDailySales || 1,
          lookbackDays: data.lookbackDays || 7,
          appBaseUrl: window.location.origin,
        },
        (response) => {
          if (response?.ok === false) {
            postToPage({
              type: "HUNTPRO_ERROR",
              error: response?.error || "Could not start HuntPro background hunt.",
            });
            return;
          }
          postToPage({
            type: "HUNTPRO_STATUS",
            status: "running",
            message: "Hunt started in background — opening eBay tabs…",
          });
        },
      );
      return;
    }

    if (
      data.type === "HUNTPRO_SEARCH" &&
      (data.source === "ecomtool" || data.source === "huntpro-extension" || !data.source)
    ) {
      postToPage({ type: "HUNTPRO_STATUS", status: "started", message: "HuntPro received keyword search…" });
      relayToBackground(
        {
          type: "HUNTPRO_SEARCH",
          userId: data.userId,
          keyword: data.keyword,
          days: data.days || 7,
          appBaseUrl: window.location.origin,
        },
        (response) => {
          if (response?.ok === false) {
            postToPage({
              type: "HUNTPRO_ERROR",
              error: response?.error || "Could not start HuntPro keyword hunt.",
            });
          }
        },
      );
    }
  });

  window.addEventListener("ecomtool-huntpro-ping", () => {
    replyPong();
  });

  replyPong();
  setTimeout(replyPong, 500);
  setTimeout(replyPong, 1500);
})();
