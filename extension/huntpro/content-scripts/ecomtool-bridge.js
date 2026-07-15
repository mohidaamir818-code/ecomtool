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

  function relayToBackground(payload, respondToPage) {
    try {
      chrome.runtime.sendMessage(payload, (response) => {
        void chrome.runtime.lastError;
        if (typeof respondToPage === "function") {
          respondToPage(response || { ok: false, error: "No response from HuntPro." });
        }
      });
    } catch {
      if (typeof respondToPage === "function") {
        respondToPage({ ok: false, error: "HuntPro extension context invalid." });
      }
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

  window.addEventListener("message", (event) => {
    // Accept page + same-window messages (ignore other frames/windows).
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
      postToPage({ type: "HUNTPRO_STATUS", status: "started" });
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
          if (response?.ok) {
            postToPage({
              type: "HUNTPRO_RESULTS",
              productCount: response.productCount,
            });
          } else {
            postToPage({
              type: "HUNTPRO_ERROR",
              error: response?.error || "Random hunt failed.",
            });
          }
        },
      );
      return;
    }

    if (
      data.type === "HUNTPRO_SEARCH" &&
      (data.source === "ecomtool" || data.source === "huntpro-extension" || !data.source)
    ) {
      postToPage({ type: "HUNTPRO_STATUS", status: "started" });
      relayToBackground(
        {
          type: "HUNTPRO_SEARCH",
          userId: data.userId,
          keyword: data.keyword,
          days: data.days || 7,
          appBaseUrl: window.location.origin,
        },
        (response) => {
          if (response?.ok) {
            postToPage({
              type: "HUNTPRO_RESULTS",
              productCount: response.productCount,
            });
          } else {
            postToPage({
              type: "HUNTPRO_ERROR",
              error: response?.error || "Keyword hunt failed.",
            });
          }
        },
      );
    }
  });

  window.addEventListener("ecomtool-huntpro-ping", () => {
    replyPong();
  });

  // Announce presence immediately + after short delays (SPA / late listeners).
  replyPong();
  setTimeout(replyPong, 500);
  setTimeout(replyPong, 1500);
})();
