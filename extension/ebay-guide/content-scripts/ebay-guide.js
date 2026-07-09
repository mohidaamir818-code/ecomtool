(function () {
  const ROOT_ID = "ecomtool-ebay-guide-root";
  const BRAND = "#5842F4";

  const GRABLEY_URL =
    "https://chromewebstore.google.com/detail/grabley-product-search-to/hppdgjpcbnbfapnailmeiibngpolplao";
  const SOLD_COUNT_WAIT_MS = 4500;
  const SOLD_COUNT_POLL_MS = 400;
  const MIN_QUALIFYING_SOLD = 20;

  let activeGuide = null;
  let currentStepIndex = 0;
  let highlightEl = null;
  let observer = null;
  let soldCountPollTimer = null;
  let combinedHighlight = null;

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
    combinedHighlight = null;
    if (soldCountPollTimer) {
      clearTimeout(soldCountPollTimer);
      soldCountPollTimer = null;
    }
    const root = document.getElementById(ROOT_ID);
    if (root) {
      if (typeof root._guideCleanup === "function") root._guideCleanup();
      root.remove();
    }
  }

  function matchesAdvanceUrl(step) {
    const pattern = step?.advanceOnUrl;
    if (!pattern) return false;
    const href = window.location.href;
    return String(pattern)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .some((part) => href.includes(part));
  }

  function urlMatches(pattern) {
    const href = window.location.href;
    const host = window.location.hostname;
    return href.includes(pattern) || host.includes(pattern);
  }

  function isVisibleElement(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return (
      rect.width > 8 &&
      rect.height > 8 &&
      style.visibility !== "hidden" &&
      style.display !== "none"
    );
  }

  function getTodayEbayDateString() {
    const now = new Date();
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }

  function isCombinedSoldStep(step) {
    return step?.combinedSoldHints || String(step?.selector || "").includes("sold-date-count");
  }

  function isSoldCountStep(step) {
    if (isCombinedSoldStep(step)) return false;
    return step?.waitSoldCount || String(step?.selector || "").includes("sold-count");
  }

  function findSoldCountElement() {
    const candidates = [];

    for (const el of document.querySelectorAll("span, div, td, a, p, li")) {
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      const match = text.match(/Sold:\s*(\d+)/i);
      if (!match || !isVisibleElement(el)) continue;

      const hasChildMatch = Array.from(el.children).some((child) =>
        /Sold:\s*\d+/i.test((child.textContent || "").replace(/\s+/g, " ").trim()),
      );
      if (hasChildMatch) continue;

      candidates.push({ el, count: match[1] });
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => Number(b.count) - Number(a.count));
    return candidates[0];
  }

  function isSoldDateStep(step) {
    if (isCombinedSoldStep(step)) return false;
    return String(step?.selector || "").includes("sold-date");
  }

  function findSoldCountInItem(item) {
    for (const el of item.querySelectorAll("span, div, td, a, p, li")) {
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      const match = text.match(/Sold:\s*(\d+)/i);
      if (!match || !isVisibleElement(el)) continue;

      const hasChildMatch = Array.from(el.children).some((child) =>
        /Sold:\s*\d+/i.test((child.textContent || "").replace(/\s+/g, " ").trim()),
      );
      if (hasChildMatch) continue;

      return { el, count: Number(match[1]) };
    }
    return null;
  }

  function findSoldDateInItem(item) {
    const today = getTodayEbayDateString();
    const soldDatePattern = /Sold\s+\d{1,2}\s+\w{3,}\s+\d{4}/i;

    for (const el of item.querySelectorAll(
      ".s-item__caption--signal, .s-item__caption, .s-item__title--tag, span, div",
    )) {
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!soldDatePattern.test(text) || /Sold:\s*\d+/i.test(text) || !isVisibleElement(el)) {
        continue;
      }

      const hasChildMatch = Array.from(el.children).some((child) => {
        const childText = (child.textContent || "").replace(/\s+/g, " ").trim();
        return soldDatePattern.test(childText) && !/Sold:\s*\d+/i.test(childText);
      });
      if (hasChildMatch) continue;

      return { el, isToday: text.includes(today) };
    }
    return null;
  }

  function getListingContainer(element) {
    return element?.closest(".s-item, li.s-item, li.s-card, li.srp-results__item, li");
  }

  function qualifiesCombinedProduct(dateInfo, countInfo) {
    return Boolean(dateInfo?.isToday && countInfo && countInfo.count > MIN_QUALIFYING_SOLD);
  }

  function resolveCombinedSoldTarget() {
    return findCombinedSoldHighlight();
  }

  function findCombinedSoldHighlight() {
    let best = null;
    let bestCount = -1;

    for (const item of document.querySelectorAll(".s-item, li.s-item, li.s-card, li.srp-results__item")) {
      const dateInfo = findSoldDateInItem(item);
      const countInfo = findSoldCountInItem(item);
      if (!qualifiesCombinedProduct(dateInfo, countInfo)) continue;

      if (countInfo.count <= bestCount) continue;
      bestCount = countInfo.count;
      best = {
        dateEl: dateInfo.el,
        countEl: countInfo.el,
        soldCount: countInfo.count,
        soldDateText: (dateInfo.el.textContent || "").replace(/\s+/g, " ").trim(),
      };
    }

    return best;
  }

  function findSoldDateLabel() {
    const today = getTodayEbayDateString();
    const soldDatePattern = /Sold\s+\d{1,2}\s+\w{3,}\s+\d{4}/i;
    let fallback = null;

    for (const item of document.querySelectorAll(".s-item, li.s-item, li.s-card, li.srp-results__item")) {
      for (const el of item.querySelectorAll(
        ".s-item__caption--signal, .s-item__caption, .s-item__title--tag, span, div",
      )) {
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (!soldDatePattern.test(text) || /Sold:\s*\d+/i.test(text) || !isVisibleElement(el)) {
          continue;
        }
        if (text.includes(today)) return el;
        if (!fallback) fallback = el;
      }
    }

    for (const el of document.querySelectorAll("span,div")) {
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!soldDatePattern.test(text) || /Sold:\s*\d+/i.test(text) || !isVisibleElement(el)) {
        continue;
      }
      if (text.includes(today)) return el;
      if (!fallback) fallback = el;
    }

    return fallback;
  }

  function getProductListingStatus() {
    const buyBtn = document.querySelector(
      '#binBtn_btn, #atcRedesignId_btn, [data-testid="x-bin-action"] button, .x-bin-action__btn, .ux-call-to-action a, button[data-test-id="x-bin-action"]',
    );
    if (buyBtn && isVisibleElement(buyBtn)) return "instock";

    const pageText = document.body.innerText.toLowerCase();
    const soldPhrases = [
      "this listing was ended",
      "this listing has ended",
      "no longer available",
      "out of stock",
      "ended by the seller",
      "listing was sold",
    ];
    if (soldPhrases.some((phrase) => pageText.includes(phrase))) return "sold";

    const soldBadge = Array.from(document.querySelectorAll("span, div, h2, p")).find((el) => {
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      return /^(sold|ended)$/i.test(text) || /^sold\s+\d{1,2}\s+\w{3,}/i.test(text);
    });
    if (soldBadge && isVisibleElement(soldBadge)) return "sold";

    return buyBtn ? "instock" : "sold";
  }

  function resolveProductStep(step) {
    if (!step?.productCheck) return step;

    const status = getProductListingStatus();
    if (status === "instock") {
      return {
        ...step,
        message: step.messageInStock || step.message,
        action: "next",
      };
    }

    return {
      ...step,
      message: step.messageSold || step.message,
      action: "ok-back",
    };
  }

  function isSoldItemsStep(step) {
    const selector = String(step?.selector || "");
    const message = String(step?.message || "");
    return (
      selector.includes("LH_Sold") ||
      selector.includes("Sold items") ||
      message.includes("Sold items")
    );
  }

  function findSoldItemsCheckboxRow() {
    for (const input of document.querySelectorAll('input[type="checkbox"]')) {
      const aria = (input.getAttribute("aria-label") || "").toLowerCase();
      const id = (input.getAttribute("id") || "").toLowerCase();
      if (!aria.includes("sold items") && !id.includes("lh_sold")) continue;

      const row =
        input.closest("li.x-refine__item, li.srp-refine__item, .x-refine__item, label, li, a") ||
        input;
      const target = getHighlightTarget(input) || row;
      if (isVisibleElement(target)) return target;
    }

    const textNodes = document.querySelectorAll(
      "label, span, a, li, .x-refine__multi-select li",
    );
    for (const node of textNodes) {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (text !== "Sold items") continue;

      const row = node.closest("li.x-refine__item, li.srp-refine__item, label, li, a") || node;
      if (isVisibleElement(row)) return row;
    }

    return null;
  }

  function getHighlightTarget(element) {
    if (!element) return null;

    if (element.matches('input[type="checkbox"]')) {
      const row = element.closest("li.x-refine__item, li.srp-refine__item, label, li, a");
      if (isVisibleElement(row)) return row;

      const id = element.getAttribute("id");
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (isVisibleElement(label)) return label;
      }
    }

    if (!isVisibleElement(element)) {
      const parent = element.closest(
        "label, li, a, button, .x-refine__item, .srp-refine__item",
      );
      if (isVisibleElement(parent)) return parent;
    }

    return element;
  }

  function querySelector(step) {
    try {
      if (isSoldItemsStep(step)) {
        const soldRow = findSoldItemsCheckboxRow();
        if (soldRow) return soldRow;
      }

      if (isSoldDateStep(step)) {
        const soldDate = findSoldDateLabel();
        if (soldDate) return soldDate;
      }

      if (isCombinedSoldStep(step)) {
        const combined = findCombinedSoldHighlight();
        if (combined?.dateEl) return combined.dateEl;
      }

      if (isSoldCountStep(step)) {
        const soldCount = findSoldCountElement();
        if (soldCount) return soldCount.el;
      }

      const selectors = String(step.selector || "")
        .split(",")
        .map((selector) => selector.trim())
        .filter(Boolean);

      for (const selector of selectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        for (const element of elements) {
          if (isSoldItemsStep(step)) {
            const aria = (element.getAttribute?.("aria-label") || "").toLowerCase();
            const text = (element.textContent || "").replace(/\s+/g, " ").trim();
            const href = element.getAttribute?.("href") || "";
            const isSold =
              aria.includes("sold items") ||
              text === "Sold items" ||
              href.includes("LH_Sold=1");
            if (!isSold) continue;
          }

          const target = getHighlightTarget(element);
          if (isVisibleElement(target)) return target;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  function getHighlightRect(target) {
    const rect = target.getBoundingClientRect();
    const minWidth = 220;
    const minHeight = 40;
    const width = Math.max(rect.width + 16, minWidth);
    const height = Math.max(rect.height + 12, minHeight);

    return {
      top: rect.top + rect.height / 2 - height / 2,
      left: rect.left + rect.width / 2 - width / 2,
      width,
      height,
      emphasis: rect.width < 180 || rect.height < 32,
    };
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

  function getUnionRect(elements) {
    const rects = elements
      .filter(Boolean)
      .map((el) => el.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    if (!rects.length) return null;

    const top = Math.min(...rects.map((rect) => rect.top));
    const left = Math.min(...rects.map((rect) => rect.left));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));

    return {
      top,
      left,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    };
  }

  function paintSpotlightRing(root, element, spotKey) {
    const ring = root.querySelector(`[data-spot="${spotKey}"]`);
    if (!ring || !element || !document.contains(element)) return;

    const rect = element.getBoundingClientRect();
    ring.style.top = `${Math.max(8, rect.top - 6)}px`;
    ring.style.left = `${Math.max(8, rect.left - 6)}px`;
    ring.style.width = `${rect.width + 12}px`;
    ring.style.height = `${rect.height + 12}px`;
  }

  function paintCombinedOverlay(root, combined, step) {
    if (!root || !combined?.dateEl || !combined?.countEl) return;

    paintSpotlightRing(root, combined.dateEl, "date");
    paintSpotlightRing(root, combined.countEl, "count");

    const anchorRect = getUnionRect([combined.dateEl, combined.countEl]);
    const tooltip = root.querySelector(".ecomtool-guide-tooltip");
    if (!anchorRect || !tooltip) return;

    const pos = getTooltipPosition(anchorRect, step.position || "right");
    tooltip.style.top = `${pos.top}px`;
    tooltip.style.left = `${pos.left}px`;
    tooltip.style.width = `${pos.width}px`;
  }

  function paintOverlay(root, target, step, index, total) {
    if (!root || !target || !document.contains(target)) return;

    const box = getHighlightRect(target);
    const spotlight = root.querySelector(".ecomtool-guide-spotlight");
    const tooltip = root.querySelector(".ecomtool-guide-tooltip");
    if (!spotlight || !tooltip) return;

    spotlight.className = box.emphasis
      ? "ecomtool-guide-spotlight ecomtool-guide-spotlight-emphasis"
      : "ecomtool-guide-spotlight";
    spotlight.style.top = `${Math.max(8, box.top)}px`;
    spotlight.style.left = `${Math.max(8, box.left)}px`;
    spotlight.style.width = `${box.width}px`;
    spotlight.style.height = `${box.height}px`;

    const anchorRect = {
      top: box.top,
      left: box.left,
      right: box.left + box.width,
      bottom: box.top + box.height,
      width: box.width,
      height: box.height,
    };
    const pos = getTooltipPosition(anchorRect, step.position || "bottom");
    tooltip.style.top = `${pos.top}px`;
    tooltip.style.left = `${pos.left}px`;
    tooltip.style.width = `${pos.width}px`;
  }

  function formatStepMessage(step, extras) {
    const todayDate = getTodayEbayDateString();
    const soldCount =
      extras?.soldCount != null && extras.soldCount !== "" ? String(extras.soldCount) : "";
    const soldDate = extras?.soldDate ? String(extras.soldDate) : "";
    let message = String(step?.message || "")
      .replace(/\{\{todayDate\}\}/g, todayDate)
      .replace(/\{\{soldCount\}\}/g, soldCount)
      .replace(/\{\{soldDate\}\}/g, soldDate);
    if (extras?.useNoGrableyMessage) {
      message = String(step?.messageNoGrabley || message);
    }
    if (extras?.useNoMatchMessage) {
      message = String(step?.messageNoMatch || message);
    }
    if (message.includes("<strong>") || message.includes("<b>")) {
      return message;
    }
    return escapeHtml(message);
  }

  function bindOverlayActions(tooltip, step, index, total) {
    const isFirst = index === 0;
    const isLast = index >= total - 1;
    const useOk = step.action === "ok";
    const useOkBack = step.action === "ok-back";
    const useFinish = step.action === "finish";

    const useOkRestart = step.action === "ok-restart-search";

    if (useOk) {
      tooltip.querySelector('[data-action="ok"]')?.addEventListener("click", () => dismissAndAdvance(index));
    } else if (useOkBack) {
      tooltip.querySelector('[data-action="ok"]')?.addEventListener("click", () => handleSoldProductBack());
    } else if (useOkRestart) {
      tooltip.querySelector('[data-action="ok"]')?.addEventListener("click", () => handleNoQualifyingProduct());
    } else {
      tooltip
        .querySelector('[data-action="next"]')
        ?.addEventListener("click", () => goStep(index + 1, useFinish || isLast));
      tooltip.querySelector('[data-action="back"]')?.addEventListener("click", () => goStep(index - 1, false));
    }
    tooltip.querySelector('[data-action="skip"]')?.addEventListener("click", () => stopGuide());
  }

  function buildTooltipActions(step, index, total) {
    const isFirst = index === 0;
    const isLast = index >= total - 1;
    const useOk = step.action === "ok";
    const useOkBack = step.action === "ok-back";
    const useFinish = step.action === "finish";
    const grableyUrl = step.grableyUrl || GRABLEY_URL;
    const useAutoAdvance = Boolean(step.advanceOnUrl);

    const useOkRestart = step.action === "ok-restart-search";

    if (step.showGrableyButton) {
      return `
        <div class="ecomtool-guide-actions ecomtool-guide-actions-stack">
          <a href="${grableyUrl}" target="_blank" rel="noopener noreferrer" class="ecomtool-guide-btn ecomtool-guide-btn-primary ecomtool-guide-btn-link">Add Grabley</a>
          <button type="button" class="ecomtool-guide-btn ecomtool-guide-btn-secondary" data-action="ok">OK</button>
        </div>
      `;
    }

    return `
      <div class="ecomtool-guide-actions">
        <button type="button" class="ecomtool-guide-btn ecomtool-guide-btn-ghost" data-action="skip">Skip</button>
        <div class="ecomtool-guide-actions-main">
          ${useOk || useOkBack || useOkRestart ? "" : isFirst ? "" : '<button type="button" class="ecomtool-guide-btn ecomtool-guide-btn-secondary" data-action="back">Back</button>'}
          ${
            useOk || useOkBack || useOkRestart
              ? '<button type="button" class="ecomtool-guide-btn ecomtool-guide-btn-primary" data-action="ok">OK</button>'
              : useAutoAdvance
                ? ""
                : `<button type="button" class="ecomtool-guide-btn ecomtool-guide-btn-primary" data-action="next">
            ${useFinish || isLast ? "Finish" : "Next"}
          </button>`
          }
        </div>
      </div>
    `;
  }

  function renderSoldCountStep(step, index, total) {
    cleanup();
    const startedAt = Date.now();

    function poll() {
      const found = isCombinedSoldStep(step) ? resolveCombinedSoldTarget() : findSoldCountElement();

      if (found?.dateEl && found?.countEl) {
        renderCombinedOverlay(step, index, total, found);
        return;
      }

      if (found && !isCombinedSoldStep(step)) {
        const soldCountValue = found.count;
        const resolvedStep = {
          ...step,
          message: String(step.message || "").replace(/\{\{soldCount\}\}/g, String(soldCountValue)),
        };
        renderOverlay(resolvedStep, index, total, found.el, soldCountValue);
        return;
      }

      if (Date.now() - startedAt < SOLD_COUNT_WAIT_MS) {
        soldCountPollTimer = window.setTimeout(poll, SOLD_COUNT_POLL_MS);
        return;
      }

      const finalCombined = isCombinedSoldStep(step) ? resolveCombinedSoldTarget() : null;
      if (finalCombined?.dateEl && finalCombined?.countEl) {
        renderCombinedOverlay(step, index, total, finalCombined);
        return;
      }

      if (!findSoldCountElement()) {
        renderGrableyFallback(step, index, total);
        return;
      }

      renderNoQualifyingProductFallback(step, index, total);
    }

    poll();
  }

  function renderNoQualifyingProductFallback(step, index, total) {
    cleanup();

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="ecomtool-guide-backdrop ecomtool-guide-backdrop-light"></div>
      <div class="ecomtool-guide-tooltip ecomtool-guide-tooltip-center" role="dialog"></div>
    `;
    document.body.appendChild(root);

    const tooltip = root.querySelector(".ecomtool-guide-tooltip");
    const fallbackStep = { ...step, action: "ok-restart-search" };
    tooltip.innerHTML = `
      <div class="ecomtool-guide-badge">EcomTool · eBay Guide</div>
      <p class="ecomtool-guide-step-count">Step ${index + 1} of ${total}</p>
      <p class="ecomtool-guide-message">${formatStepMessage(step, { useNoMatchMessage: true })}</p>
      ${buildTooltipActions(fallbackStep, index, total)}
    `;

    bindOverlayActions(tooltip, fallbackStep, index, total);
  }

  function renderGrableyFallback(step, index, total) {
    cleanup();

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="ecomtool-guide-backdrop ecomtool-guide-backdrop-light"></div>
      <div class="ecomtool-guide-tooltip ecomtool-guide-tooltip-center" role="dialog"></div>
    `;
    document.body.appendChild(root);

    const tooltip = root.querySelector(".ecomtool-guide-tooltip");
    const fallbackStep = { ...step, action: "ok", showGrableyButton: true };
    tooltip.innerHTML = `
      <div class="ecomtool-guide-badge">EcomTool · eBay Guide</div>
      <p class="ecomtool-guide-step-count">Step ${index + 1} of ${total}</p>
      <p class="ecomtool-guide-message">${formatStepMessage(step, { useNoGrableyMessage: true })}</p>
      ${buildTooltipActions(fallbackStep, index, total)}
    `;

    bindOverlayActions(tooltip, fallbackStep, index, total);
  }

  function renderCombinedOverlay(step, index, total, combined) {
    cleanup();

    combinedHighlight = combined;
    highlightEl = combined.dateEl;

    const item =
      combined.dateEl.closest(".s-item, li.s-item") ||
      combined.countEl.closest(".s-item, li.s-item");
    if (item) {
      item.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    } else {
      combined.dateEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="ecomtool-guide-backdrop"></div>
      <div class="ecomtool-guide-spotlight-ring" data-spot="date"></div>
      <div class="ecomtool-guide-spotlight-ring" data-spot="count"></div>
      <div class="ecomtool-guide-tooltip" role="dialog" aria-label="EcomTool guide step"></div>
    `;
    document.body.appendChild(root);

    const tooltip = root.querySelector(".ecomtool-guide-tooltip");
    tooltip.innerHTML = `
      <div class="ecomtool-guide-badge">EcomTool · eBay Guide</div>
      <p class="ecomtool-guide-step-count">Step ${index + 1} of ${total}</p>
      <p class="ecomtool-guide-message">${formatStepMessage(step, {
        soldCount: combined.soldCount,
        soldDate: combined.soldDateText,
      })}</p>
      ${buildTooltipActions(step, index, total)}
    `;

    bindOverlayActions(tooltip, step, index, total);

    function refreshPaint() {
      if (!combinedHighlight || !document.getElementById(ROOT_ID)) return;
      paintCombinedOverlay(root, combinedHighlight, step);
    }

    window.addEventListener("scroll", refreshPaint, true);
    window.addEventListener("resize", refreshPaint);
    root._guideCleanup = () => {
      window.removeEventListener("scroll", refreshPaint, true);
      window.removeEventListener("resize", refreshPaint);
    };

    window.setTimeout(refreshPaint, 220);
    window.setTimeout(refreshPaint, 520);
  }

  function renderOverlay(step, index, total, presetTarget, presetSoldCount) {
    cleanup();

    const target = presetTarget || querySelector(step);
    if (!target) {
      renderWaiting(step, index, total);
      return;
    }

    highlightEl = target;
    target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="ecomtool-guide-spotlight"></div>
      <div class="ecomtool-guide-tooltip" role="dialog" aria-label="EcomTool guide step"></div>
    `;
    document.body.appendChild(root);

    const tooltip = root.querySelector(".ecomtool-guide-tooltip");
    const soldCount =
      presetSoldCount != null
        ? String(presetSoldCount)
        : isCombinedSoldStep(step)
          ? findCombinedSoldHighlight()?.soldCount
          : findSoldCountElement()?.count;

    tooltip.innerHTML = `
      <div class="ecomtool-guide-badge">EcomTool · eBay Guide</div>
      <p class="ecomtool-guide-step-count">Step ${index + 1} of ${total}</p>
      <p class="ecomtool-guide-message">${formatStepMessage(step, { soldCount: soldCount ?? "" })}</p>
      ${buildTooltipActions(step, index, total)}
    `;

    bindOverlayActions(tooltip, step, index, total);

    function refreshPaint() {
      if (highlightEl !== target || !document.getElementById(ROOT_ID)) return;
      paintOverlay(root, target, step, index, total);
    }

    window.addEventListener("scroll", refreshPaint, true);
    window.addEventListener("resize", refreshPaint);
    root._guideCleanup = () => {
      window.removeEventListener("scroll", refreshPaint, true);
      window.removeEventListener("resize", refreshPaint);
    };

    window.setTimeout(refreshPaint, 220);
    window.setTimeout(refreshPaint, 520);
  }

  function renderWaiting(step, index, total) {
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="ecomtool-guide-backdrop ecomtool-guide-backdrop-light"></div>
      <div class="ecomtool-guide-tooltip ecomtool-guide-tooltip-center" role="dialog">
        <div class="ecomtool-guide-badge">EcomTool · eBay Guide</div>
        <p class="ecomtool-guide-step-count">Step ${index + 1} of ${total}</p>
        <p class="ecomtool-guide-message">${formatStepMessage(step)}</p>
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

  function dismissAndAdvance(index) {
    cleanup();
    goStep(index + 1, false);
  }

  function handleNoQualifyingProduct() {
    cleanup();
    chrome.runtime.sendMessage({ type: "EBAY_GUIDE_STEP", stepIndex: 0, completed: false }, () => {
      void chrome.runtime.lastError;
      currentStepIndex = 0;
      showCurrentStep();
    });
  }

  function handleSoldProductBack() {
    cleanup();
    chrome.runtime.sendMessage({ type: "EBAY_GUIDE_STEP", stepIndex: 3, completed: false }, () => {
      void chrome.runtime.lastError;
      currentStepIndex = 3;
      if (window.history.length > 1) {
        window.history.back();
      }
    });
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

    const rawStep = steps[index];
    if (rawStep?.advanceOnUrl && matchesAdvanceUrl(rawStep)) {
      goStep(index + 1, false);
      return;
    }

    if (
      (isSoldCountStep(rawStep) || isCombinedSoldStep(rawStep)) &&
      urlMatches(rawStep.urlPattern)
    ) {
      renderSoldCountStep(rawStep, index, steps.length);
      return;
    }

    const step = resolveProductStep(rawStep);
    if (!urlMatches(step.urlPattern)) {
      if (step.silentWait) {
        cleanup();
        return;
      }
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
