const STORAGE_KEYS = {
  userId: "ebay_guide_user_id",
  activeGuide: "ebay_guide_active",
  progress: "ebay_guide_progress",
};

async function loadGuideSteps(guideId) {
  try {
    const url = chrome.runtime.getURL("config/guide-steps.json");
    const response = await fetch(url);
    const data = await response.json();
    const guide = (data.guides || []).find((g) => g.id === guideId);
    return guide?.steps ?? null;
  } catch {
    return null;
  }
}

async function fetchGuideStepsFromApp(guideId) {
  const { appBaseUrl } = await chrome.storage.local.get("appBaseUrl");
  const base = appBaseUrl || "http://localhost:3000";
  try {
    const response = await fetch(
      `${base}/api/ebay-guide/steps?guideId=${encodeURIComponent(guideId)}`,
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.steps ?? null;
  } catch {
    return null;
  }
}

async function resolveGuideSteps(guideId) {
  const fromApp = await fetchGuideStepsFromApp(guideId);
  if (fromApp?.length) return fromApp;
  return loadGuideSteps(guideId);
}

async function saveProgress(userId, guideId, stepIndex, completed) {
  const key = `${STORAGE_KEYS.progress}_${userId}_${guideId}`;
  await chrome.storage.local.set({
    [key]: { stepIndex, completed, updatedAt: Date.now() },
  });

  const { appBaseUrl } = await chrome.storage.local.get("appBaseUrl");
  const base = appBaseUrl || "http://localhost:3000";
  try {
    await fetch(`${base}/api/ebay-guide/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, guideId, stepIndex, completed }),
    });
  } catch {
    // Optional sync — local progress is enough for v1.
  }
}

async function startGuide(guideId, userId) {
  const steps = await resolveGuideSteps(guideId);
  if (!steps?.length) {
    return { ok: false, error: "Guide not found or has no steps." };
  }

  const activeGuide = {
    guideId,
    userId: userId || null,
    stepIndex: 0,
    steps,
    startedAt: Date.now(),
  };

  await chrome.storage.local.set({ [STORAGE_KEYS.activeGuide]: activeGuide });
  if (userId) {
    await chrome.storage.local.set({ [STORAGE_KEYS.userId]: userId });
  }

  await notifyEbayTabs({ type: "EBAY_GUIDE_REFRESH" });
  return { ok: true, activeGuide };
}

async function notifyEbayTabs(message) {
  const tabs = await chrome.tabs.query({
    url: ["*://*.ebay.com/*", "*://*.ebay.co.uk/*"],
  });
  for (const tab of tabs) {
    if (tab.id != null) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    }
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    const type = message?.type;

    if (type === "EBAY_GUIDE_GET_STATE") {
      const data = await chrome.storage.local.get([
        STORAGE_KEYS.activeGuide,
        STORAGE_KEYS.userId,
      ]);
      sendResponse({
        activeGuide: data[STORAGE_KEYS.activeGuide] ?? null,
        userId: data[STORAGE_KEYS.userId] ?? null,
      });
      return;
    }

    if (type === "EBAY_GUIDE_START") {
      const result = await startGuide(message.guideId, message.userId);
      sendResponse(result);
      return;
    }

    if (type === "EBAY_GUIDE_STOP") {
      await chrome.storage.local.remove(STORAGE_KEYS.activeGuide);
      await notifyEbayTabs({ type: "EBAY_GUIDE_STOP" });
      sendResponse({ ok: true });
      return;
    }

    if (type === "EBAY_GUIDE_STEP") {
      const data = await chrome.storage.local.get(STORAGE_KEYS.activeGuide);
      const active = data[STORAGE_KEYS.activeGuide];
      if (!active) {
        sendResponse({ ok: false });
        return;
      }

      const stepIndex =
        typeof message.stepIndex === "number" ? message.stepIndex : active.stepIndex;
      const completed = Boolean(message.completed);
      const updated = { ...active, stepIndex };

      if (completed || stepIndex >= active.steps.length) {
        await chrome.storage.local.remove(STORAGE_KEYS.activeGuide);
        if (active.userId) {
          await saveProgress(active.userId, active.guideId, stepIndex, true);
        }
        await notifyEbayTabs({ type: "EBAY_GUIDE_STOP" });
        sendResponse({ ok: true, completed: true });
        return;
      }

      await chrome.storage.local.set({ [STORAGE_KEYS.activeGuide]: updated });
      if (active.userId) {
        await saveProgress(active.userId, active.guideId, stepIndex, false);
      }
      sendResponse({ ok: true, activeGuide: updated });
      return;
    }

    if (type === "EBAY_GUIDE_CONNECT") {
      const userId = message.userId?.trim();
      if (userId) {
        await chrome.storage.local.set({ [STORAGE_KEYS.userId]: userId });
      }
      sendResponse({ ok: Boolean(userId) });
      return;
    }

    if (type === "EBAY_GUIDE_SET_APP_URL") {
      if (message.appBaseUrl) {
        await chrome.storage.local.set({ appBaseUrl: message.appBaseUrl });
      }
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message type." });
  })();

  return true;
});

// Relay window.postMessage events forwarded by the EcomTool bridge content script.
chrome.runtime.onMessageExternal?.addListener(() => {});
