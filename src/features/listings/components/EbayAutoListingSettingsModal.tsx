"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_EBAY_AUTO_LISTING_SETTINGS,
  normalizeEbayAutoListingSettings,
  validateEbayAutoListingSettingsInput,
  type EbayAutoListingSettings,
} from "@/features/listings/lib/ebay-auto-listing";
import type { SellerPreferences, VolumePromotionTier } from "@/types/listing-generator";

// Fee/price fields the AI prompt can set that live in seller preferences (not in
// the auto-listing settings object). Applied via onApplyPreferences when present.
const PREFERENCE_KEYS = [
  "paymentFeePercent",
  "transactionFeeAmount",
  "shippingCost",
  "profitMarginPercent",
] as const;

interface GuidedOption {
  label: string;
  value: string;
}

interface GuidedQuestion {
  id: string;
  question: string;
  options: GuidedOption[];
}

const GUIDED_CHAT_QUESTIONS: GuidedQuestion[] = [
  {
    id: "goal",
    question: "What should be optimized first?",
    options: [
      { label: "Fast sales", value: "fast_sales" },
      { label: "Higher profit", value: "high_profit" },
      { label: "Balanced", value: "balanced" },
    ],
  },
  {
    id: "min_profit",
    question: "Select your minimum profit target.",
    options: [
      { label: "10%", value: "10" },
      { label: "15%", value: "15" },
      { label: "20%", value: "20" },
      { label: "25%", value: "25" },
    ],
  },
  {
    id: "pricing_mode",
    question: "How should price compare to market?",
    options: [
      { label: "Auto smart pricing", value: "auto" },
      { label: "1% below market", value: "percent_1" },
      { label: "3% below market", value: "percent_3" },
      { label: "£0.50 below market", value: "amount_0_5" },
    ],
  },
  {
    id: "ending",
    question: "Pick a price ending style.",
    options: [
      { label: "Always .99", value: "99" },
      { label: ".95", value: "95" },
      { label: "Range based (.99/.59/.89)", value: "ranges" },
      { label: "No charm ending", value: "off" },
    ],
  },
  {
    id: "promote",
    question: "Should eBay auto-promotion be enabled?",
    options: [
      { label: "Yes, safe mode", value: "safe" },
      { label: "Yes, aggressive", value: "aggressive" },
      { label: "No promotion", value: "off" },
    ],
  },
];

interface EbayAutoListingSettingsModalProps {
  initialSettings: EbayAutoListingSettings;
  onSave: (settings: EbayAutoListingSettings) => void;
  onClose: () => void;
  sellerPreferences?: SellerPreferences | null;
  onApplyPreferences?: (preferences: SellerPreferences) => void;
}

export function EbayAutoListingSettingsModal({
  initialSettings,
  onSave,
  onClose,
  sellerPreferences,
  onApplyPreferences,
}: EbayAutoListingSettingsModalProps) {
  const [form, setForm] = useState<EbayAutoListingSettings>(() =>
    normalizeEbayAutoListingSettings(initialSettings),
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
  const [aiApplied, setAiApplied] = useState<{ prompt: string; summary: string } | null>(null);
  const [aiEditing, setAiEditing] = useState(true);
  const [aiGuidedAnswers, setAiGuidedAnswers] = useState<Record<string, GuidedOption>>({});

  // Second box: seller's own custom price-ending / pricing rules in plain words.
  const [rulePrompt, setRulePrompt] = useState("");
  const [ruleBusy, setRuleBusy] = useState(false);
  const [ruleClarify, setRuleClarify] = useState("");
  const [rulePending, setRulePending] = useState<{ summary: string; settings: Record<string, unknown> } | null>(
    null,
  );
  const [ruleApplied, setRuleApplied] = useState<{ prompt: string; summary: string } | null>(null);
  const [ruleEditing, setRuleEditing] = useState(true);

  useEffect(() => {
    setForm(normalizeEbayAutoListingSettings(initialSettings));
  }, [initialSettings]);

  function buildGuidedPrompt(answers: Record<string, GuidedOption>): string {
    const goal = answers.goal?.value ?? "balanced";
    const minProfit = Number(answers.min_profit?.value ?? "15");
    const pricingMode = answers.pricing_mode?.value ?? "auto";
    const ending = answers.ending?.value ?? "99";
    const promote = answers.promote?.value ?? "safe";

    const lines: string[] = [];
    lines.push(`Primary goal: ${goal.replace("_", " ")}.`);
    lines.push(`Minimum profit must be at least ${minProfit}%.`);

    if (pricingMode === "auto") {
      lines.push("Enable smart pricing with automatic market undercut.");
    } else if (pricingMode === "percent_1") {
      lines.push("Enable smart pricing and keep price 1% below market average.");
    } else if (pricingMode === "percent_3") {
      lines.push("Enable smart pricing and keep price 3% below market average.");
    } else {
      lines.push("Enable smart pricing and keep price GBP 0.50 below market average.");
    }

    if (ending === "off") {
      lines.push("Disable charm pricing.");
    } else if (ending === "ranges") {
      lines.push("Enable charm pricing with range endings: up to 1.50 -> .99, up to 1.99 -> .59, above that -> .89.");
    } else {
      lines.push(`Enable charm pricing with .${ending} ending.`);
    }

    if (promote === "off") {
      lines.push("Disable auto promotion.");
    } else if (promote === "aggressive") {
      lines.push("Enable auto promotion with ad rate 12% and minimum profit GBP 2.");
    } else {
      lines.push("Enable auto promotion with ad rate 8% and minimum profit GBP 4.");
    }

    return lines.join(" ");
  }

  function applyParsedSettings(parsed: { summary: string; settings: Record<string, unknown> }, sourcePrompt: string) {
    setForm((current) => normalizeEbayAutoListingSettings({ ...current, ...parsed.settings }));

    if (onApplyPreferences && sellerPreferences) {
      const prefPatch: Record<string, unknown> = {};
      for (const key of PREFERENCE_KEYS) {
        if (parsed.settings[key] != null) prefPatch[key] = Number(parsed.settings[key]);
      }
      if (Object.keys(prefPatch).length > 0) {
        onApplyPreferences({ ...sellerPreferences, ...prefPatch } as SellerPreferences);
      }
    }

    setAiApplied({ prompt: sourcePrompt, summary: parsed.summary });
    setAiEditing(false);
    setAiPending(null);
    setAiClarify("");
    setAiQuestion("");
    setAiFeeAnswer("");
    setError("");
  }

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
        body: JSON.stringify({ platform: "ebay", instruction, currentSettings: form }),
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
    const appliedPrompt = rulePrompt.trim();
    setForm((current) => normalizeEbayAutoListingSettings({ ...current, ...rulePending.settings }));

    if (onApplyPreferences && sellerPreferences) {
      const prefPatch: Record<string, unknown> = {};
      for (const key of PREFERENCE_KEYS) {
        if (rulePending.settings[key] != null) prefPatch[key] = Number(rulePending.settings[key]);
      }
      if (Object.keys(prefPatch).length > 0) {
        onApplyPreferences({ ...sellerPreferences, ...prefPatch } as SellerPreferences);
      }
    }

    setRuleApplied({ prompt: appliedPrompt, summary: rulePending.summary });
    setRuleEditing(false);
    setRulePending(null);
    setRuleClarify("");
    setError("");
  }

  async function handleAiParse(instructionOverride?: string) {
    const instruction = (instructionOverride ?? aiPrompt).trim();
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
        body: JSON.stringify({ platform: "ebay", instruction, currentSettings: form }),
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
        const parsed = { summary: result.summary, settings: result.settings };
        if (result.question) {
          setAiPending(parsed);
          setAiQuestion(result.question);
        } else {
          applyParsedSettings(parsed, instruction);
        }
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
        body: JSON.stringify({ platform: "ebay", instruction: combined, currentSettings: form }),
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
    applyParsedSettings(aiPending, aiPrompt.trim());
  }

  function updateField<K extends keyof EbayAutoListingSettings>(
    key: K,
    value: EbayAutoListingSettings[K],
  ) {
    setForm((current) => normalizeEbayAutoListingSettings({ ...current, [key]: value }));
    setError("");
  }

  function updatePromotion(index: number, patch: Partial<VolumePromotionTier>) {
    setForm((current) => {
      const promotions = current.promotions.map((tier, i) =>
        i === index ? { ...tier, ...patch } : tier,
      );
      return normalizeEbayAutoListingSettings({ ...current, promotions });
    });
    setError("");
  }

  function handleSubmit() {
    const next = normalizeEbayAutoListingSettings(form);
    const validationError = validateEbayAutoListingSettingsInput(next);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSave(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[#111827]">eBay auto listing settings</h2>
        <p className="mt-2 text-sm text-[#6B7280]">
          Set your rules once. AI will apply them automatically for every URL you submit.
        </p>

        <p className="mt-4 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-[#475569]">
          Configure your eBay listing behavior manually below.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-[#111827]">eBay platform fee %</span>
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
              min={0}
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
              min={0}
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

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-[#111827]">Volume discounts</h3>
          <p className="mt-1 text-xs text-[#6B7280]">
            Enable any tier to include volume discounts on your eBay listings.
          </p>
          <div className="mt-3 space-y-2">
            {form.promotions.map((tier, index) => (
              <div
                key={tier.quantity}
                className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <label className="flex items-center gap-2 text-sm font-medium text-[#111827]">
                  <input
                    type="checkbox"
                    checked={tier.enabled}
                    onChange={(event) => updatePromotion(index, { enabled: event.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                  />
                  Buy {tier.quantity}, get discount
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={90}
                    disabled={!tier.enabled}
                    value={tier.discountPercent}
                    onChange={(event) =>
                      updatePromotion(index, { discountPercent: Number(event.target.value) || 0 })
                    }
                    className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-brand disabled:bg-white"
                  />
                  <span className="text-xs text-[#6B7280]">% off</span>
                </div>
              </div>
            ))}
          </div>
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
                AI checks the live eBay average price for each product and lists just below it
                to sell faster — while always keeping your minimum profit. If the market is too
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
                    name="ebay-undercut-mode"
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
                    name="ebay-undercut-mode"
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
                    name="ebay-undercut-mode"
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

        <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
              checked={form.autoPromoteEnabled}
              onChange={(event) => updateField("autoPromoteEnabled", event.target.checked)}
            />
            <span>
              <span className="font-medium text-[#111827]">Auto promote on eBay</span>
              <span className="mt-1 block text-xs text-[#6B7280]">
                After listing, eligible products are added to your Promoted Listings campaign
                automatically so they show higher in search.
              </span>
            </span>
          </label>
          {form.autoPromoteEnabled ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-[#111827]">Only promote if profit ≥</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.autoPromoteMinProfit}
                  onChange={(event) =>
                    updateField("autoPromoteMinProfit", Number(event.target.value))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                />
                <span className="mt-1 block text-xs text-[#6B7280]">
                  Per item, after fees. 0 promotes everything.
                </span>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#111827]">Ad rate %</span>
                <input
                  type="number"
                  min={2}
                  max={100}
                  step={0.5}
                  value={form.autoPromoteAdRatePercent}
                  onChange={(event) =>
                    updateField("autoPromoteAdRatePercent", Number(event.target.value))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                />
                <span className="mt-1 block text-xs text-[#6B7280]">
                  Fee charged by eBay only when the item sells via the ad.
                </span>
              </label>
            </div>
          ) : null}
        </div>

        <div className="mt-5 rounded-lg border border-violet-100 bg-violet-50/50 px-4 py-3 text-sm">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
              checked={form.aiPhotoEditEnabled}
              onChange={(event) => updateField("aiPhotoEditEnabled", event.target.checked)}
            />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-[#111827]">AI photo edit</span>
              <span className="mt-1 block text-xs text-[#6B7280]">
                When on, up to 3 AliExpress photos are edited with your prompt during prepare
                (parallel — keeps listing near 30–55s).
              </span>
            </span>
          </label>
          {form.aiPhotoEditEnabled ? (
            <textarea
              value={form.aiPhotoEditPrompt}
              onChange={(event) => updateField("aiPhotoEditPrompt", event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              rows={3}
              maxLength={500}
              placeholder="e.g. Clean white background, remove Chinese text/logos, soft studio lighting"
              className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
            />
          ) : null}
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
            checked={form.listVeroProducts}
            onChange={(event) => updateField("listVeroProducts", event.target.checked)}
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
          Your settings: profit {form.minProfitPercent}–{form.maxProfitPercent}%, stock{" "}
          {form.minStock}–{form.maxStock}. Lower profit % is allowed (down to 0%).
        </p>
      </div>
    </div>
  );
}
