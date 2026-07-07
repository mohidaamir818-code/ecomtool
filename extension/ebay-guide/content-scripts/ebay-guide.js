(function () {
  const ROOT_ID = "ecomtool-ebay-guide-root";
  const BRAND = "#5842F4";

  let activeGuide = null;
  let currentStepIndex = 0;
  let highlightEl = null;
  let observer = null;

  function isEbayPage() {
    return /ebay\.(com|co\.uk)/i.test(window.location.hostname);
  }

  if (!isEbayPage()) return;

  function cleanup() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    highlightEl = null;
    const root = document.getElementById(ROOT_ID);
    if (root) root.remove();
  }

  function urlMatches(pattern) {
    const href = window.location.href;
    const host = window.location.hostname;
    return href.includes(pattern) || host.includes(pattern);
  }

  function querySelector(step) {
    try {
      return document.querySelector(step.selector);
    } catch {
      return null;
    }
  }

  function getTooltipPosition(rect, position) {
    const gap = 12;
    const tooltipWidth = 320;
    const tooltipHeight = 180;
    let top = rect.bottom + gap;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;

    if (position === "top") {
      top = rect.top - tooltipHeight - gap;
    } else if (position === "left") {
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.left - tooltipWidth - gap;
    } else if (position === "right") {
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.right + gap;
    } else if (position === "bottom") {
      top = rect.bottom + gap;
    }

    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));
    top = Math.max(12, Math.min(top, window.innerHeight - tooltipHeight - 12));

    return { top, left, width: tooltipWidth };
  }

  function renderOverlay(step, index, total) {
    cleanup();

    const target = querySelector(step);
    if (!target) {
      renderWaiting(step, index, total);
      return;
    }

    highlightEl = target;
    const rect = target.getBoundingClientRect();

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="ecomtool-guide-backdrop"></div>
      <div class="ecomtool-guide-spotlight" style="
        top:${Math.max(0, rect.top - 6)}px;
        left:${Math.max(0, rect.left - 6)}px;
        width:${rect.width + 12}px;
        height:${rect.height + 12}px;
      "></div>
      <div class="ecomtool-guide-tooltip" role="dialog" aria-label="EcomTool guide step"></div>
    `;

    document.body.appendChild(root);

    const tooltip = root.querySelector(".ecomtool-guide-tooltip");
    const pos = getTooltipPosition(rect, step.position || "bottom");
    tooltip.style.top = `${pos.top}px`;
    tooltip.style.left = `${pos.left}px`;
    tooltip.style.width = `${pos.width}px`;

    const isFirst = index === 0;
    const isLast = index >= total - 1;

    tooltip.innerHTML = `
      <div class="ecomtool-guide-badge">EcomTool · eBay Guide</div>
      <p class="ecomtool-guide-step-count">Step ${index + 1} of ${total}</p>
      <p class="ecomtool-guide-message">${escapeHtml(step.message)}</p>
      <div class="ecomtool-guide-actions">
        <button type="button" class="ecomtool-guide-btn ecomtool-guide-btn-ghost" data-action="skip">Skip</button>
        <div class="ecomtool-guide-actions-main">
          ${isFirst ? "" : '<button type="button" class="ecomtool-guide-btn ecomtool-guide-btn-secondary" data-action="back">Back</button>'}
          <button type="button" class="ecomtool-guide-btn ecomtool-guide-btn-primary" data-action="next">
            ${isLast ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    `;

    tooltip.querySelector('[data-action="next"]')?.addEventListener("click", () => goStep(index + 1, isLast));
    tooltip.querySelector('[data-action="back"]')?.addEventListener("click", () => goStep(index - 1, false));
    tooltip.querySelector('[data-action="skip"]')?.addEventListener("click", () => stopGuide());

    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }

  function renderWaiting(step, index, total) {
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="ecomtool-guide-backdrop ecomtool-guide-backdrop-light"></div>
      <div class="ecomtool-guide-tooltip ecomtool-guide-tooltip-center" role="dialog">
        <div class="ecomtool-guide-badge">EcomTool · eBay Guide</div>
        <p class="ecomtool-guide-step-count">Step ${index + 1} of ${total}</p>
        <p class="ecomtool-guide-message">${escapeHtml(step.message)}</p>
        <p class="ecomtool-guide-hint">Waiting for the page element… Navigate or complete the previous step.</p>
        <div class="ecomtool-guide-actions">
          <button type="button" class="ecomtool-guide-btn ecomtool-guide-btn-ghost" data-action="skip">Skip guide</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    root.querySelector('[data-action="skip"]')?.addEventListener("click", () => stopGuide());

    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      const el = querySelector(step);
      if (el) {
        observer.disconnect();
        observer = null;
        renderOverlay(step, index, total);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function goStep(nextIndex, completed) {
    chrome.runtime.sendMessage(
      { type: "EBAY_GUIDE_STEP", stepIndex: nextIndex, completed },
      () => {
        void chrome.runtime.lastError;
        if (completed) {
          cleanup();
          activeGuide = null;
          return;
        }
        currentStepIndex = nextIndex;
        showCurrentStep();
      },
    );
  }

  function stopGuide() {
    chrome.runtime.sendMessage({ type: "EBAY_GUIDE_STOP" }, () => {
      void chrome.runtime.lastError;
      cleanup();
      activeGuide = null;
    });
  }

  function showCurrentStep() {
    if (!activeGuide?.steps?.length) {
      cleanup();
      return;
    }

    const steps = activeGuide.steps;
    let index = currentStepIndex;
    if (index < 0) index = 0;
    if (index >= steps.length) {
      goStep(index, true);
      return;
    }

    const step = steps[index];
    if (!urlMatches(step.urlPattern)) {
      renderWaiting(step, index, steps.length);
      return;
    }

    renderOverlay(step, index, steps.length);
  }

  function loadAndShow() {
    chrome.runtime.sendMessage({ type: "EBAY_GUIDE_GET_STATE" }, (response) => {
      if (chrome.runtime.lastError || !response?.activeGuide) {
        cleanup();
        return;
      }
      activeGuide = response.activeGuide;
      currentStepIndex = activeGuide.stepIndex || 0;
      showCurrentStep();
    });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "EBAY_GUIDE_REFRESH") {
      loadAndShow();
    }
    if (message?.type === "EBAY_GUIDE_STOP") {
      cleanup();
      activeGuide = null;
    }
  });

  window.addEventListener("popstate", () => setTimeout(loadAndShow, 400));
  window.addEventListener("hashchange", () => setTimeout(loadAndShow, 400));

  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(loadAndShow, 500);
    }
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });

  loadAndShow();
})();
