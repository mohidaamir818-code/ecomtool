const DEFAULT_APP_BASE = "http://localhost:3000";
const GUIDE_ID = "hunting-basics";
const EBAY_URL = "https://www.ebay.co.uk";

async function getAppBaseUrl() {
  const data = await chrome.storage.local.get("appBaseUrl");
  return data.appBaseUrl || DEFAULT_APP_BASE;
}

async function refreshStatus() {
  const statusEl = document.getElementById("status");
  const data = await chrome.storage.local.get(["ebay_guide_user_id", "ebay_guide_active"]);
  const userId = data.ebay_guide_user_id;
  const active = data.ebay_guide_active;

  if (userId && active) {
    statusEl.textContent = `Connected · Guide active (step ${(active.stepIndex || 0) + 1})`;
    statusEl.className = "status ok";
  } else if (userId) {
    statusEl.textContent = "Connected to EcomTool";
    statusEl.className = "status ok";
  } else {
    statusEl.textContent = "Not connected — link your EcomTool account";
    statusEl.className = "status warn";
  }
}

document.getElementById("connectBtn")?.addEventListener("click", async () => {
  const base = await getAppBaseUrl();
  chrome.tabs.create({ url: `${base}/api/ebay-guide/connect` });
});

document.getElementById("startBtn")?.addEventListener("click", async () => {
  const data = await chrome.storage.local.get("ebay_guide_user_id");
  chrome.runtime.sendMessage(
    {
      type: "EBAY_GUIDE_START",
      guideId: GUIDE_ID,
      userId: data.ebay_guide_user_id || null,
    },
    () => {
      void chrome.runtime.lastError;
      chrome.tabs.create({ url: EBAY_URL });
      window.close();
    },
  );
});

refreshStatus();
