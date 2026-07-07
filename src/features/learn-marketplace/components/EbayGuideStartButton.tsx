"use client";

import { useCallback, useEffect, useState } from "react";

const EBAY_GUIDE_EXTENSION_URL =
  "https://chromewebstore.google.com/search/EcomTool%20eBay%20Guide";
const EBAY_GUIDE_CONNECT_URL = "/api/ebay-guide/connect";
const DEFAULT_GUIDE_ID = "hunting-basics";
const EBAY_START_URL = "https://www.ebay.co.uk";
const PING_TIMEOUT_MS = 2000;

type ExtensionState = "checking" | "installed" | "missing";

export function EbayGuideStartButton() {
  const [extensionState, setExtensionState] = useState<ExtensionState>("checking");
  const [userId, setUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const pingExtension = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      let answered = false;

      function onMessage(event: MessageEvent) {
        const data = event.data as { type?: string; source?: string } | null;
        if (!data || data.type !== "ECOMTOOL_EBAY_GUIDE_PONG") return;
        if (data.source && data.source !== "ebay-guide-extension") return;
        answered = true;
        window.removeEventListener("message", onMessage);
        resolve(true);
      }

      window.addEventListener("message", onMessage);
      window.postMessage({ type: "ECOMTOOL_EBAY_GUIDE_PING", source: "ecomtool" }, "*");

      window.setTimeout(() => {
        if (!answered) {
          window.removeEventListener("message", onMessage);
          resolve(false);
        }
      }, PING_TIMEOUT_MS);
    });
  }, []);

  useEffect(() => {
    const id = sessionStorage.getItem("ecomtools_user_id");
    if (id) setUserId(id);

    void (async () => {
      const installed = await pingExtension();
      setExtensionState(installed ? "installed" : "missing");
    })();

    function onConnect(event: MessageEvent) {
      const data = event.data as { type?: string; userId?: string } | null;
      if (!data || data.type !== "ECOMTOOL_EBAY_GUIDE_CONNECT") return;
      if (data.userId) setUserId(data.userId);
      setNotice("Extension connected to your EcomTool account.");
    }

    window.addEventListener("message", onConnect);
    return () => window.removeEventListener("message", onConnect);
  }, [pingExtension]);

  function startGuide() {
    if (!userId) {
      setNotice("Sign in to EcomTool to start the guide.");
      return;
    }

    window.postMessage(
      {
        type: "ECOMTOOL_EBAY_GUIDE_START",
        source: "ecomtool",
        guideId: DEFAULT_GUIDE_ID,
        userId,
      },
      "*",
    );

    setNotice("Guide started — opening eBay. Follow the on-page prompts.");
    window.open(EBAY_START_URL, "_blank", "noopener,noreferrer");
  }

  if (extensionState === "checking") {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#6B7280]">
        Checking eBay Guide extension…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#DDD6FE] bg-[#EEF0FF]/60 px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">
            Real eBay practice
          </p>
          <p className="mt-1 text-sm font-semibold text-[#111827]">
            Product hunting guide (Chrome extension)
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">
            Step-by-step overlays on ebay.co.uk — search, sold listings, and pricing.
          </p>
          {notice ? <p className="mt-2 text-xs font-medium text-brand">{notice}</p> : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {extensionState === "installed" ? (
            <button
              type="button"
              onClick={startGuide}
              className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(88,66,244,0.35)] transition hover:bg-brand-dark"
            >
              Start eBay guide (extension)
            </button>
          ) : (
            <>
              <a
                href={EBAY_GUIDE_EXTENSION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
              >
                Install extension
              </a>
              <a
                href={EBAY_GUIDE_CONNECT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-2 text-xs font-semibold text-[#374151] transition hover:bg-gray-50"
              >
                Connect extension
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
