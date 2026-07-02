"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_AMAZEF_AUTO_LISTING_SETTINGS,
  normalizeAutoListingSettings,
  validateAutoListingSettingsInput,
  type AmazefAutoListingSettings,
} from "@/features/listings/lib/amazef-auto-listing";

import type { SellerPreferences } from "@/types/listing-generator";

// Fee/price fields the AI prompt can set that live in seller preferences (not in
// the auto-listing settings object). Applied via onApplyPreferences when present.
const PREFERENCE_KEYS = [
  "paymentFeePercent",
  "transactionFeeAmount",
  "shippingCost",
  "profitMarginPercent",
] as const;

interface AmazefAutoListingSettingsModalProps {
  initialSettings: AmazefAutoListingSettings;
  onSave: (settings: AmazefAutoListingSettings) => void;
  onClose: () => void;
  sellerPreferences?: SellerPreferences | null;
  onApplyPreferences?: (preferences: SellerPreferences) => void;
}

export function AmazefAutoListingSettingsModal({
  initialSettings,
  onSave,
  onClose,
  sellerPreferences,
  onApplyPreferences,
}: AmazefAutoListingSettingsModalProps) {
  const [form, setForm] = useState<AmazefAutoListingSettings>(() =>
    normalizeAutoListingSettings(initialSettings),
  );
  const [error, setError] = useState("");
  const alreadyEnabled = initialSettings.enabled;

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiClarify, setAiClarify] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiFeeAnswer, setAiFeeAnswer] = useState("");
  const [aiPending, setAiPending] = useState<{ summary: string; settings: Record<string, unknown> } | null>(
    null,
  );

  // Second box: seller's own custom price-ending / pricing rules in plain words.
  const [rulePrompt, setRulePrompt] = useState("");
  const [ruleBusy, setRuleBusy] = useState(false);
  const [ruleClarify, setRuleClarify] = useState("");
  const [rulePending, setRulePending] = useState<{ summary: string; settings: Record<string, unknown> } | null>(
    null,
  );

  // BOGO (Buy One Get One) rules, described by the seller in plain words.
  const [bogoPrompt, setBogoPrompt] = useState("");
  const [bogoBusy, setBogoBusy] = useState(false);
  const [bogoClarify, setBogoClarify] = useState("");
  const [bogoPending, setBogoPending] = useState<{ summary: string; settings: Record<string, unknown> } | null>(
    null,
  );

  // Flash sale rules, described by the seller in plain words.
  const [flashPrompt, setFlashPrompt] = useState("");
  const [flashBusy, setFlashBusy] = useState(false);
  const [flashClarify, setFlashClarify] = useState("");
  const [flashPending, setFlashPending] = useState<{ summary: string; settings: Record<string, unknown> } | null>(
    null,
  );

  useEffect(() => {
    setForm(normalizeAutoListingSettings(initialSettings));
  }, [initialSettings]);

  async function handleRuleParse() {
    const instruction = rulePrompt.trim();
    if (!instruction) return;
    setRuleBusy(true);
    setRuleClarify("");
    setRulePending(null);
    try {
      const response = await fetch("/api/listings/parse-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "amazef", instruction, currentSettings: form }),
      });
      const data = await response.json();
      if (!response.ok) {
        setRuleClarify(data?.error ?? "Could not understand your rules. Please try again.");
        return;
      }
      const result = data.result as {
        understood: boolean;
        summary: string;
        clarification: string | null;
        settings: Record<string, unknown>;
      };
      if (result.understood) {
        setRulePending({ summary: result.summary, settings: result.settings });
      } else {
        setRuleClarify(result.clarification ?? "Please rewrite your rules more clearly.");
      }
    } catch {
      setRuleClarify("Something went wrong. Please try again.");
    } finally {
      setRuleBusy(false);
    }
  }

  function handleRuleApply() {
    if (!rulePending) return;
    setForm((current) => normalizeAutoListingSettings({ ...current, ...rulePending.settings }));

    if (onApplyPreferences && sellerPreferences) {
      const prefPatch: Record<string, unknown> = {};
      for (const key of PREFERENCE_KEYS) {
        if (rulePending.settings[key] != null) prefPatch[key] = Number(rulePending.settings[key]);
      }
      if (Object.keys(prefPatch).length > 0) {
        onApplyPreferences({ ...sellerPreferences, ...prefPatch } as SellerPreferences);
      }
    }

    setRulePending(null);
    setRuleClarify("");
    setRulePrompt("");
    setError("");
  }

  async function handlePromoParse(
    instruction: string,
    setBusy: (value: boolean) => void,
    setClarify: (value: string) => void,
    setPending: (value: { summary: string; settings: Record<string, unknown> } | null) => void,
  ) {
    const text = instruction.trim();
    if (!text) return;
    setBusy(true);
    setClarify("");
    setPending(null);
    try {
      const response = await fetch("/api/listings/parse-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "amazef", instruction: text, currentSettings: form }),
      });
      const data = await response.json();
      if (!response.ok) {
        setClarify(data?.error ?? "Could not understand your rules. Please try again.");
        return;
      }
      const result = data.result as {
        understood: boolean;
        summary: string;
        clarification: string | null;
        settings: Record<string, unknown>;
      };
      if (result.understood) {
        setPending({ summary: result.summary, settings: result.settings });
      } else {
        setClarify(result.clarification ?? "Please rewrite your rules more clearly.");
      }
    } catch {
      setClarify("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleBogoApply() {
    if (!bogoPending) return;
    setForm((current) => normalizeAutoListingSettings({ ...current, ...bogoPending.settings }));
    setBogoPending(null);
    setBogoClarify("");
    setBogoPrompt("");
    setError("");
  }

  function handleFlashApply() {
    if (!flashPending) return;
    setForm((current) => normalizeAutoListingSettings({ ...current, ...flashPending.settings }));
    setFlashPending(null);
    setFlashClarify("");
    setFlashPrompt("");
    setError("");
  }

  async function handleAiParse() {
    const instruction = aiPrompt.trim();
    if (!instruction) return;
    setAiBusy(true);
    setAiClarify("");
    setAiQuestion("");
    setAiFeeAnswer("");
    setAiPending(null);
    try {
      const response = await fetch("/api/listings/parse-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "amazef", instruction, currentSettings: form }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAiClarify(data?.error ?? "Could not understand your rules. Please try again.");
        return;
      }
      const result = data.result as {
        understood: boolean;
        summary: string;
        clarification: string | null;
        question: string | null;
        settings: Record<string, unknown>;
      };
      if (result.understood) {
        setAiPending({ summary: result.summary, settings: result.settings });
        if (result.question) setAiQuestion(result.question);
      } else {
        setAiClarify(result.clarification ?? "Please rewrite your rules more clearly.");
      }
    } catch {
      setAiClarify("Something went wrong. Please try again.");
    } finally {
      setAiBusy(false);
    }
  }

  async function handleAiFeeAnswer() {
    const answer = aiFeeAnswer.trim();
    if (!answer || !aiPending) return;
    const combined = `${aiPrompt.trim()}\n\n${answer}`;
    setAiBusy(true);
    setAiClarify("");
    try {
      const response = await fetch("/api/listings/parse-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "amazef", instruction: combined, currentSettings: form }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAiClarify(data?.error ?? "Could not understand your answer. Please try again.");
        return;
      }
      const result = data.result as {
        understood: boolean;
        summary: string;
        clarification: string | null;
        question: string | null;
        settings: Record<string, unknown>;
      };
      if (result.understood) {
        setAiPending({
          summary: result.summary,
          settings: { ...aiPending.settings, ...result.settings },
        });
        setAiQuestion(result.question?.trim() ? result.question : "");
        setAiFeeAnswer("");
      } else {
        setAiClarify(result.clarification ?? "Please rewrite your fees more clearly.");
      }
    } catch {
      setAiClarify("Something went wrong. Please try again.");
    } finally {
      setAiBusy(false);
    }
  }

  function handleAiApply() {
    if (!aiPending) return;
    setForm((current) => normalizeAutoListingSettings({ ...current, ...aiPending.settings }));

    // Detailed fee/price fields live in seller preferences — apply them there.
    if (onApplyPreferences && sellerPreferences) {
      const prefPatch: Record<string, unknown> = {};
      for (const key of PREFERENCE_KEYS) {
        if (aiPending.settings[key] != null) prefPatch[key] = Number(aiPending.settings[key]);
      }
      if (Object.keys(prefPatch).length > 0) {
        onApplyPreferences({ ...sellerPreferences, ...prefPatch } as SellerPreferences);
      }
    }

    setAiPending(null);
    setAiClarify("");
    setAiQuestion("");
    setAiFeeAnswer("");
    setAiPrompt("");
    setError("");
  }

  function updateField<K extends keyof AmazefAutoListingSettings>(key: K, value: AmazefAutoListingSettings[K]) {
    setForm((current) => normalizeAutoListingSettings({ ...current, [key]: value }));
    setError("");
  }

  function handleSubmit() {
    const next = normalizeAutoListingSettings(form);
    const validationError = validateAutoListingSettingsInput(next);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSave(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[#111827]">Auto listing settings</h2>
        <p className="mt-2 text-sm text-[#6B7280]">
          Set your rules once. AI will apply them automatically for every URL you submit.
        </p>

        <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
          <span className="text-sm font-semibold text-[#111827]">
            Describe your rules (English)
          </span>
          <p className="mt-1 text-xs text-[#6B7280]">
            e.g. "Keep price 5% below market and end prices with .99, with minimum profit of 20%."
            AI will fill the settings below for you.
          </p>
          <textarea
            value={aiPrompt}
            onChange={(event) => {
              setAiPrompt(event.target.value);
              setAiClarify("");
              setAiQuestion("");
              setAiFeeAnswer("");
              setAiPending(null);
            }}
            rows={3}
            placeholder="Write your pricing rules here…"
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleAiParse}
              disabled={aiBusy || !aiPrompt.trim()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aiBusy ? "Understanding…" : "Apply with AI"}
            </button>
            {aiBusy ? <span className="text-xs text-[#6B7280]">Reading your rules…</span> : null}
          </div>

          {aiClarify ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {aiClarify}
            </div>
          ) : null}

          {aiPending ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
              <span className="block font-medium text-[#111827]">Here’s what I understood:</span>
              <span className="mt-1 block text-[#374151]">{aiPending.summary}</span>

              {aiQuestion ? (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                  <span className="block text-sm font-medium text-[#111827]">{aiQuestion}</span>
                  <input
                    type="text"
                    value={aiFeeAnswer}
                    onChange={(event) => setAiFeeAnswer(event.target.value)}
                    placeholder="e.g. Amazef fee 15%, payment fee 2.9%"
                    className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={handleAiFeeAnswer}
                    disabled={aiBusy || !aiFeeAnswer.trim()}
                    className="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {aiBusy ? "Updating…" : "Add fees & update"}
                  </button>
                </div>
              ) : null}

              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleAiApply}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Yes, apply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAiPending(null);
                    setAiQuestion("");
                    setAiFeeAnswer("");
                  }}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-gray-50"
                >
                  No, I’ll rewrite
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
          <span className="text-sm font-semibold text-[#111827]">
            Your own price rules (e.g. .99 / .59 / .89 endings)
          </span>
          <p className="mt-1 text-xs text-[#6B7280]">
            Describe how you want prices to end by price range. AI will apply your rules.
          </p>
          <textarea
            value={rulePrompt}
            onChange={(event) => {
              setRulePrompt(event.target.value);
              setRuleClarify("");
              setRulePending(null);
            }}
            rows={3}
            placeholder="Write your price-ending rules here..."
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleRuleParse}
              disabled={ruleBusy || !rulePrompt.trim()}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {ruleBusy ? "Understanding…" : "Apply with AI"}
            </button>
            {ruleBusy ? <span className="text-xs text-[#6B7280]">Reading your rules…</span> : null}
          </div>

          {ruleClarify ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {ruleClarify}
            </div>
          ) : null}

          {rulePending ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
              <span className="block font-medium text-[#111827]">Here’s what I understood:</span>
              <span className="mt-1 block text-[#374151]">{rulePending.summary}</span>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleRuleApply}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Yes, apply
                </button>
                <button
                  type="button"
                  onClick={() => setRulePending(null)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-gray-50"
                >
                  No, I’ll rewrite
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50/60 p-4">
          <span className="text-sm font-semibold text-[#111827]">
            Buy One Get One (BOGO) rules
          </span>
          <p className="mt-1 text-xs text-[#6B7280]">
            Describe when BOGO should apply. e.g. "Apply Buy One Get One Free when profit is above
            GBP 4." AI will understand and apply your rule.
          </p>
          <textarea
            value={bogoPrompt}
            onChange={(event) => {
              setBogoPrompt(event.target.value);
              setBogoClarify("");
              setBogoPending(null);
            }}
            rows={3}
            placeholder="Write your BOGO rules here..."
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                handlePromoParse(bogoPrompt, setBogoBusy, setBogoClarify, setBogoPending)
              }
              disabled={bogoBusy || !bogoPrompt.trim()}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bogoBusy ? "Understanding…" : "Apply with AI"}
            </button>
            {bogoBusy ? <span className="text-xs text-[#6B7280]">Reading your rules…</span> : null}
          </div>

          {bogoClarify ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {bogoClarify}
            </div>
          ) : null}

          {bogoPending ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
              <span className="block font-medium text-[#111827]">Here’s what I understood:</span>
              <span className="mt-1 block text-[#374151]">{bogoPending.summary}</span>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleBogoApply}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Yes, apply
                </button>
                <button
                  type="button"
                  onClick={() => setBogoPending(null)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-gray-50"
                >
                  No, I’ll rewrite
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
          <span className="text-sm font-semibold text-[#111827]">Flash sale rules</span>
          <p className="mt-1 text-xs text-[#6B7280]">
            Describe how you want flash sale to work. e.g. "Keep the real price the same, but show
            a higher discount during flash sale." Or "Apply 20% flash-sale discount when profit is
            above GBP 5." AI will understand and apply your rule.
          </p>
          <textarea
            value={flashPrompt}
            onChange={(event) => {
              setFlashPrompt(event.target.value);
              setFlashClarify("");
              setFlashPending(null);
            }}
            rows={3}
            placeholder="Write your flash sale rules here..."
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                handlePromoParse(flashPrompt, setFlashBusy, setFlashClarify, setFlashPending)
              }
              disabled={flashBusy || !flashPrompt.trim()}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {flashBusy ? "Understanding…" : "Apply with AI"}
            </button>
            {flashBusy ? <span className="text-xs text-[#6B7280]">Reading your rules…</span> : null}
          </div>

          {flashClarify ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {flashClarify}
            </div>
          ) : null}

          {flashPending ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
              <span className="block font-medium text-[#111827]">Here’s what I understood:</span>
              <span className="mt-1 block text-[#374151]">{flashPending.summary}</span>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleFlashApply}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Yes, apply
                </button>
                <button
                  type="button"
                  onClick={() => setFlashPending(null)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-gray-50"
                >
                  No, I’ll rewrite
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-[#111827]">Amazef platform fee %</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={form.platformFeePercent}
              onChange={(event) => updateField("platformFeePercent", Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <span className="mt-1 block text-xs text-[#6B7280]">
              Deducted from the price first, then your profit margin is applied on top.
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#111827]">Min profit %</span>
            <input
              type="number"
              min={1}
              max={90}
              value={form.minProfitPercent}
              onChange={(event) => updateField("minProfitPercent", Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#111827]">Max profit %</span>
            <input
              type="number"
              min={1}
              max={95}
              value={form.maxProfitPercent}
              onChange={(event) => updateField("maxProfitPercent", Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#111827]">Min stock</span>
            <input
              type="number"
              min={1}
              value={form.minStock}
              onChange={(event) => updateField("minStock", Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#111827]">Max stock</span>
            <input
              type="number"
              min={1}
              value={form.maxStock}
              onChange={(event) => updateField("maxStock", Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
        </div>

        <div className="mt-6 rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-3">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
              checked={form.smartPricingEnabled}
              onChange={(event) => updateField("smartPricingEnabled", event.target.checked)}
            />
            <span>
              <span className="font-medium text-[#111827]">Smart pricing (recommended)</span>
              <span className="mt-1 block text-xs text-[#6B7280]">
                AI checks the live market average for each product and lists just below it to
                sell faster — while always keeping your minimum profit. If the market is too
                cheap, it falls back to your profit % rules.
              </span>
            </span>
          </label>
          {form.smartPricingEnabled ? (
            <div className="mt-3">
              <span className="text-sm font-medium text-[#111827]">How far below the market?</span>
              <div className="mt-2 space-y-2">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="amazef-undercut-mode"
                    className="mt-0.5 h-4 w-4 border-gray-300 text-brand focus:ring-brand"
                    checked={form.undercutMode === "auto"}
                    onChange={() => updateField("undercutMode", "auto")}
                  />
                  <span>
                    <span className="font-medium text-[#111827]">Auto (recommended)</span>
                    <span className="mt-0.5 block text-xs text-[#6B7280]">
                      Let our system set the undercut for you automatically.
                    </span>
                  </span>
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="amazef-undercut-mode"
                    className="h-4 w-4 border-gray-300 text-brand focus:ring-brand"
                    checked={form.undercutMode === "percent"}
                    onChange={() => updateField("undercutMode", "percent")}
                  />
                  <span className="font-medium text-[#111827]">Set my own percentage</span>
                  {form.undercutMode === "percent" ? (
                    <span className="ml-auto flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={50}
                        step={0.5}
                        value={form.marketUndercutPercent}
                        onChange={(event) =>
                          updateField("marketUndercutPercent", Number(event.target.value))
                        }
                        className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-brand"
                      />
                      <span className="text-xs text-[#6B7280]">% below</span>
                    </span>
                  ) : null}
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="amazef-undercut-mode"
                    className="h-4 w-4 border-gray-300 text-brand focus:ring-brand"
                    checked={form.undercutMode === "amount"}
                    onChange={() => updateField("undercutMode", "amount")}
                  />
                  <span className="font-medium text-[#111827]">Set my own price</span>
                  {form.undercutMode === "amount" ? (
                    <span className="ml-auto flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={form.marketUndercutAmount}
                        onChange={(event) =>
                          updateField("marketUndercutAmount", Number(event.target.value))
                        }
                        className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-brand"
                      />
                      <span className="text-xs text-[#6B7280]">below</span>
                    </span>
                  ) : null}
                </label>
              </div>
              <span className="mt-2 block text-xs text-[#6B7280]">
                Whatever you choose, the price never drops below your minimum profit.
              </span>

              {form.charmPricingEnabled && form.charmRules.length > 0 ? (
                <div className="mt-3 rounded-lg border-t border-emerald-100 bg-white px-3 py-2 text-xs text-[#374151]">
                  <span className="font-medium text-[#111827]">Custom endings:</span>
                  <ul className="mt-1 space-y-0.5">
                    {form.charmRules.map((rule, index) => (
                      <li key={index}>
                        {rule.maxPrice == null
                          ? `All other prices → .${String(rule.ending).padStart(2, "0")}`
                          : `Up to ${rule.maxPrice.toFixed(2)} → .${String(rule.ending).padStart(2, "0")}`}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-1 block text-[#6B7280]">
                    Set these by describing them in the AI box above.
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
            checked={form.listVeroProducts}
            onChange={(event) =>
              updateField("listVeroProducts", event.target.checked)
            }
          />
          <span>
            <span className="font-medium text-[#111827]">List VeRO products</span>
            <span className="mt-1 block text-xs text-[#6B7280]">
              When off, products that fail VeRO are stopped automatically.
            </span>
          </span>
        </label>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Save{alreadyEnabled ? " settings" : " & enable auto listing"}
          </button>
        </div>

        <p className="mt-4 text-xs text-[#9CA3AF]">
          Defaults: profit {DEFAULT_AMAZEF_AUTO_LISTING_SETTINGS.minProfitPercent}–
          {DEFAULT_AMAZEF_AUTO_LISTING_SETTINGS.maxProfitPercent}%, stock{" "}
          {DEFAULT_AMAZEF_AUTO_LISTING_SETTINGS.minStock}–{DEFAULT_AMAZEF_AUTO_LISTING_SETTINGS.maxStock}.
        </p>
      </div>
    </div>
  );
}
