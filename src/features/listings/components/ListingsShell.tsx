"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { useUserBlock } from "@/features/dashboard/context/UserBlockContext";
import { buildInitialDraft } from "@/features/listings/lib/draft-utils";
import { AiListingGenerator } from "./AiListingGenerator";
import { EbayConnect } from "./EbayConnect";
import { ListingConfirmStep } from "./ListingConfirmStep";
import { ListingPhotosStep } from "./ListingPhotosStep";
import { ListingPromotionsStep } from "./ListingPromotionsStep";
import { ListingVariantsStep } from "./ListingVariantsStep";
import { ListingWizardNav } from "./ListingWizardNav";
import { ListingWizardProgress } from "./ListingWizardProgress";
import { VeroBlockModal } from "./VeroBlockModal";
import { VeroChecker } from "./VeroChecker";
import type {
  GeneratedListing,
  ListingDraft,
  ListingProductSource,
  VeroCheckResult,
} from "@/types/listing-generator";

export function ListingsShell() {
  const searchParams = useSearchParams();
  const { isBlocked } = useUserBlock();

  const [userId, setUserId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [product, setProduct] = useState<ListingProductSource | null>(null);
  const [listing, setListing] = useState<GeneratedListing | null>(null);
  const [draft, setDraft] = useState<ListingDraft | null>(null);
  const [vero, setVero] = useState<VeroCheckResult | null>(null);
  const [veroLoading, setVeroLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [showVeroModal, setShowVeroModal] = useState(false);
  const [notice, setNotice] = useState("");
  const [isError, setIsError] = useState(false);
  const [listedUrl, setListedUrl] = useState<string | null>(null);

  useEffect(() => {
    const id = sessionStorage.getItem("ecomtools_user_id");
    if (id) setUserId(id);
  }, []);

  useEffect(() => {
    const ebayStatus = searchParams.get("ebay");
    const message = searchParams.get("message");

    if (ebayStatus === "connected") {
      setNotice("eBay account connected successfully.");
      setIsError(false);
    } else if (ebayStatus === "error" && message) {
      setNotice(message);
      setIsError(true);
    }
  }, [searchParams]);

  function resetWizard() {
    setCurrentStep(0);
    setProduct(null);
    setListing(null);
    setDraft(null);
    setVero(null);
    setShowVeroModal(false);
    setListedUrl(null);
    setNotice("");
    setIsError(false);
  }

  async function runVeroCheck() {
    if (!userId) return;

    if (!url.trim()) {
      setNotice("Please paste an AliExpress product URL.");
      setIsError(true);
      return;
    }

    resetWizard();
    setVeroLoading(true);

    try {
      const response = await fetch("/api/vero-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setNotice(data.error ?? "VeRO check failed.");
        setIsError(true);
        return;
      }

      setProduct(data.product ?? null);
      setVero(data.vero ?? null);

      if (!data.vero?.safe) {
        setShowVeroModal(true);
        return;
      }

      setCurrentStep(1);
      await generateListing(data.product ?? null);
    } catch {
      setNotice("Network error while running VeRO check.");
      setIsError(true);
    } finally {
      setVeroLoading(false);
    }
  }

  async function generateListing(sourceProduct: ListingProductSource | null) {
    if (!userId || !sourceProduct) return;

    setGenerateLoading(true);
    try {
      const response = await fetch("/api/generate-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, product: sourceProduct }),
      });

      const data = await response.json();

      if (!response.ok) {
        setNotice(data.error ?? "Failed to generate listing.");
        setIsError(true);
        return;
      }

      const nextProduct = data.product ?? sourceProduct;
      const nextListing = data.listing ?? null;

      setProduct(nextProduct);
      setListing(nextListing);
      if (nextListing) {
        setDraft(buildInitialDraft(nextProduct, nextListing));
      }
      setNotice("Listing generated. Review and edit before continuing.");
      setIsError(false);
    } catch {
      setNotice("Network error while generating listing.");
      setIsError(true);
    } finally {
      setGenerateLoading(false);
    }
  }

  function updateDraft(patch: Partial<ListingDraft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function updateListing(nextListing: GeneratedListing) {
    setListing(nextListing);
    setDraft((current) =>
      current
        ? {
            ...current,
            listing: {
              ...nextListing,
              brand: "Unbranded",
            },
          }
        : current,
    );
  }

  function validateStep(step: number): string | null {
    if (step === 1) {
      if (!listing?.seoTitle.trim()) return "Title is required.";
      if ((listing?.seoTitle.length ?? 0) > 80) return "Title must be 80 characters or less.";
      if ((listing?.suggestedPrice ?? 0) <= 0) return "Price must be greater than 0.";
    }

    if (step === 2) {
      if (!draft?.photos.some((photo) => photo.selected)) return "Select at least one photo.";
    }

    if (step === 3) {
      for (const variant of draft?.variants ?? []) {
        if (variant.price <= 0) return "All variant prices must be greater than 0.";
        if (variant.stock < 0) return "Variant stock cannot be negative.";
      }
    }

    return null;
  }

  function handleNext() {
    const error = validateStep(currentStep);
    if (error) {
      setNotice(error);
      setIsError(true);
      return;
    }

    setNotice("");
    setIsError(false);
    setCurrentStep((step) => Math.min(step + 1, 5));
  }

  function handleBack() {
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  const busy = veroLoading || generateLoading;
  const wizardStarted = currentStep > 0 || Boolean(vero);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[960px] p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">AI Listing Generator</h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              Step-by-step wizard to check VeRO safety, edit your listing, and publish to eBay.
            </p>
          </div>

          {wizardStarted ? (
            <button
              type="button"
              onClick={resetWizard}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-[#374151] hover:bg-gray-50"
            >
              Start new listing
            </button>
          ) : null}
        </div>

        {wizardStarted ? <ListingWizardProgress currentStep={currentStep} /> : null}

        {currentStep === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <label className="block text-sm font-medium text-[#111827]">
              AliExpress product URL
              <input
                type="url"
                value={url}
                disabled={isBlocked || busy}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.aliexpress.com/item/..."
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand disabled:opacity-60"
              />
            </label>

            <button
              type="button"
              disabled={isBlocked || busy || !userId}
              onClick={() => void runVeroCheck()}
              className="mt-4 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Processing..." : "Start VeRO Check"}
            </button>
          </div>
        ) : null}

        <div className="mt-6 space-y-6">
          {currentStep === 0 ? <VeroChecker result={vero} loading={veroLoading} /> : null}

          {currentStep === 1 && userId ? (
            <AiListingGenerator
              userId={userId}
              product={product}
              listing={listing}
              loading={generateLoading}
              onListingChange={updateListing}
            />
          ) : null}

          {currentStep === 2 && draft ? (
            <ListingPhotosStep
              photos={draft.photos}
              onChange={(photos) => updateDraft({ photos })}
            />
          ) : null}

          {currentStep === 3 && draft ? (
            <ListingVariantsStep draft={draft} onChange={(variants) => updateDraft({ variants })} />
          ) : null}

          {currentStep === 4 && draft ? (
            <ListingPromotionsStep
              promotions={draft.promotions}
              onChange={(promotions) => updateDraft({ promotions })}
            />
          ) : null}

          {currentStep === 5 && draft && userId ? (
            <ListingConfirmStep
              userId={userId}
              draft={draft}
              disabled={isBlocked}
              onListed={setListedUrl}
            />
          ) : null}

          {userId && currentStep > 0 && currentStep < 5 ? (
            <EbayConnect userId={userId} />
          ) : null}

          {notice ? (
            <p className={`text-sm ${isError ? "text-red-600" : "text-emerald-700"}`}>{notice}</p>
          ) : null}

          {listedUrl ? (
            <a
              href={listedUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-sm font-semibold text-brand hover:underline"
            >
              View listing on eBay
            </a>
          ) : null}
        </div>

        {currentStep > 0 && currentStep < 5 ? (
          <ListingWizardNav
            currentStep={currentStep}
            maxStep={5}
            onBack={handleBack}
            onNext={handleNext}
          />
        ) : null}
      </div>

      {showVeroModal && vero && !vero.safe ? (
        <VeroBlockModal result={vero} onClose={() => setShowVeroModal(false)} />
      ) : null}
    </DashboardLayout>
  );
}
