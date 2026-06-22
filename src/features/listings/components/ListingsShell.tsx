"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { useUserBlock } from "@/features/dashboard/context/UserBlockContext";
import { assignInternalSkusToDraft, buildInitialDraft, normalizeDraftVariants, recalculateDraftPricing } from "@/features/listings/lib/draft-utils";
import { draftNeedsSkuBackfill } from "@/lib/listings/internal-sku";
import { fetchSellerPreferences, persistSellerPreferences } from "@/features/listings/lib/seller-preferences-client";
import { sellerPreferencesToPromotions, promotionsToSellerPreferences } from "@/lib/listings/seller-preferences-mappers";
import { AiListingGenerator } from "./AiListingGenerator";
import { EbayAddressSetupForm } from "./EbayAddressSetupForm";
import { EbayConnect } from "./EbayConnect";
import { EbayConnectedBanner } from "./EbayConnectedBanner";
import { EbayStoreConnectGate } from "./EbayStoreConnectGate";
import { ListingConfirmStep } from "./ListingConfirmStep";
import { ListingPhotosVariantsStep } from "./ListingPhotosVariantsStep";
import { ListingProfitCalculatorStep } from "./ListingProfitCalculatorStep";
import { ListingPromotionsStep } from "./ListingPromotionsStep";
import { ListingQualityScoreStep } from "./ListingQualityScoreStep";
import { ListingShippingReturnsStep } from "./ListingShippingReturnsStep";
import { ListingWizardNav } from "./ListingWizardNav";
import { ListingWizardProgress } from "./ListingWizardProgress";
import { VeroBlockModal } from "./VeroBlockModal";
import { VeroChecker } from "./VeroChecker";
import type {
  EbayConnectionStatus,
  GeneratedListing,
  ListingDraft,
  ListingPricingPreferences,
  ListingProductSource,
  PricingBreakdown,
  SellerPreferences,
  VeroCheckResult,
} from "@/types/listing-generator";
import { defaultSellerPreferences } from "@/types/listing-generator";

const MAX_STEP = 9;

export function ListingsShell() {
  const searchParams = useSearchParams();
  const router = useRouter();
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
  const [veroAcknowledged, setVeroAcknowledged] = useState(false);
  const [notice, setNotice] = useState("");
  const [isError, setIsError] = useState(false);
  const [listedUrl, setListedUrl] = useState<string | null>(null);
  const [pricingPrefs, setPricingPrefs] = useState<ListingPricingPreferences | null>(null);
  const [pricingBreakdown, setPricingBreakdown] = useState<PricingBreakdown | null>(null);
  const [manualPriceOverride, setManualPriceOverride] = useState<number | null>(null);
  const [resumeOffer, setResumeOffer] = useState<{ productUrl: string; step: number } | null>(null);
  const [sellerPrefs, setSellerPrefs] = useState<SellerPreferences | null>(null);
  const [sellerPrefsLoading, setSellerPrefsLoading] = useState(true);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [photosVariantsError, setPhotosVariantsError] = useState<string | null>(null);
  const [ebayStatus, setEbayStatus] = useState<EbayConnectionStatus>({
    connected: false,
    ebayUsername: null,
    accessTokenExpiresAt: null,
    addressConfirmed: false,
  });
  const [ebayStatusLoading, setEbayStatusLoading] = useState(true);
  const [showEbayConnectedToast, setShowEbayConnectedToast] = useState(false);
  const generateStarted = useRef(false);
  const savedToastTimer = useRef<number | null>(null);
  const ebayConnectedToastTimer = useRef<number | null>(null);
  const oauthJustSucceeded = useRef(false);
  const oauthReturnHandled = useRef(false);
  const oauthFailureHandled = useRef(false);

  const oauthRefreshKey =
    searchParams.get("connected") ?? searchParams.get("error") ?? searchParams.get("ebay") ?? undefined;

  const isOAuthReturn = searchParams.get("connected") === "true";
  const isOAuthFailure =
    searchParams.get("error") === "connection_failed" ||
    searchParams.get("ebay") === "error";

  const loadEbayStatus = useCallback(async (options?: { silent?: boolean }) => {
    if (!userId) return null;
    if (!options?.silent) setEbayStatusLoading(true);
    try {
      const response = await fetch(`/api/ebay/status?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();
      if (response.ok) {
        const nextStatus: EbayConnectionStatus = {
          connected: Boolean(data.connected),
          ebayUsername: data.ebayUsername ?? null,
          accessTokenExpiresAt: data.accessTokenExpiresAt ?? null,
          addressConfirmed: Boolean(data.addressConfirmed),
        };
        setEbayStatus((current) => {
          if (oauthJustSucceeded.current && !nextStatus.connected) {
            return current;
          }
          if (nextStatus.connected) {
            if (nextStatus.ebayUsername) {
              oauthJustSucceeded.current = false;
            }
          }
          return nextStatus;
        });
        return nextStatus;
      }
      return null;
    } finally {
      if (!options?.silent) setEbayStatusLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const id = sessionStorage.getItem("ecomtools_user_id");
    if (id) setUserId(id);
  }, []);

  useEffect(() => {
    if (!userId) return;
    setSellerPrefsLoading(true);
    void fetchSellerPreferences(userId)
      .then(({ preferences }) => setSellerPrefs(preferences))
      .catch(() => setSellerPrefs(defaultSellerPreferences()))
      .finally(() => setSellerPrefsLoading(false));
  }, [userId]);

  function triggerSavedToast() {
    setShowSavedToast(true);
    if (savedToastTimer.current) window.clearTimeout(savedToastTimer.current);
    savedToastTimer.current = window.setTimeout(() => setShowSavedToast(false), 2500);
  }

  useEffect(() => {
    return () => {
      if (savedToastTimer.current) window.clearTimeout(savedToastTimer.current);
      if (ebayConnectedToastTimer.current) window.clearTimeout(ebayConnectedToastTimer.current);
    };
  }, []);

  function triggerEbayConnectedToast() {
    setShowEbayConnectedToast(true);
    if (ebayConnectedToastTimer.current) window.clearTimeout(ebayConnectedToastTimer.current);
    ebayConnectedToastTimer.current = window.setTimeout(() => setShowEbayConnectedToast(false), 3000);
  }

  useEffect(() => {
    if (searchParams.get("connected") === "true") return;
    if (
      searchParams.get("error") === "connection_failed" ||
      searchParams.get("ebay") === "error"
    ) {
      return;
    }
    void loadEbayStatus();
  }, [loadEbayStatus, oauthRefreshKey, searchParams]);

  useEffect(() => {
    if (searchParams.get("connected") !== "true") return;
    if (oauthReturnHandled.current) return;
    oauthReturnHandled.current = true;

    oauthJustSucceeded.current = true;
    setEbayStatusLoading(false);
    setEbayStatus((current) => ({ ...current, connected: true }));
    triggerEbayConnectedToast();
    router.replace("/dashboard/listings");
  }, [searchParams, router]);

  useEffect(() => {
    if (!oauthJustSucceeded.current || !userId) return;

    let cancelled = false;

    async function pollForUsername() {
      for (let attempt = 0; attempt < 5; attempt++) {
        if (cancelled) return;
        const status = await loadEbayStatus({ silent: true });
        if (status?.ebayUsername) return;
        if (attempt < 4) {
          await new Promise((resolve) => window.setTimeout(resolve, 1000));
        }
      }
    }

    void pollForUsername();
    return () => {
      cancelled = true;
    };
  }, [userId, loadEbayStatus]);

  useEffect(() => {
    const connectionFailed =
      searchParams.get("error") === "connection_failed" ||
      searchParams.get("ebay") === "error";

    if (!connectionFailed) return;
    if (oauthFailureHandled.current) return;
    oauthFailureHandled.current = true;

    oauthJustSucceeded.current = false;
    setEbayStatusLoading(false);
    setNotice(searchParams.get("message") ?? "eBay connection failed.");
    setIsError(true);
    router.replace("/dashboard/listings");
  }, [searchParams, router]);

  const saveDraft = useCallback(async () => {
    if (!userId || !draft) return;
    await fetch("/api/listings/drafts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        productUrl: url.trim() || product?.productUrl,
        currentStep,
        draft,
      }),
    });
  }, [userId, draft, url, product, currentStep]);

  useEffect(() => {
    if (!userId || !draft) return;
    const timer = window.setTimeout(() => void saveDraft(), 2000);
    return () => window.clearTimeout(timer);
  }, [userId, draft, currentStep, saveDraft]);

  useEffect(() => {
    if (!userId) return;
    async function loadSaved() {
      const response = await fetch(`/api/listings/drafts?userId=${encodeURIComponent(userId!)}`);
      const data = await response.json();
      if (response.ok && data.draft?.draftJson?.product) {
        setResumeOffer({
          productUrl: data.draft.productUrl ?? "",
          step: data.draft.currentStep ?? 0,
        });
      }
    }
    void loadSaved();
  }, [userId]);

  async function clearSavedDraft() {
    if (!userId) return;
    await fetch(`/api/listings/drafts?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    setResumeOffer(null);
  }

  function resetWizard() {
    setCurrentStep(0);
    setProduct(null);
    setListing(null);
    setDraft(null);
    setVero(null);
    setShowVeroModal(false);
    setVeroAcknowledged(false);
    setListedUrl(null);
    setNotice("");
    setIsError(false);
    setPricingPrefs(null);
    setPricingBreakdown(null);
    setManualPriceOverride(null);
    generateStarted.current = false;
    void clearSavedDraft();
  }

  async function runVeroCheck() {
    if (!userId || !url.trim()) {
      setNotice("Please paste an AliExpress product URL.");
      setIsError(true);
      return false;
    }

    setVeroLoading(true);
    setVeroAcknowledged(false);
    setNotice("");

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
        return false;
      }

      setProduct(data.product ?? null);
      setVero(data.vero ?? null);

      if (!data.vero?.safe) {
        setShowVeroModal(true);
        return false;
      }

      return true;
    } catch {
      setNotice("Network error while running VeRO check.");
      setIsError(true);
      return false;
    } finally {
      setVeroLoading(false);
    }
  }

  function handleVeroAcknowledgeProceed() {
    setVeroAcknowledged(true);
    setShowVeroModal(false);
    setNotice("");
    setIsError(false);
    setCurrentStep(2);
  }

  async function generateListing(sourceProduct: ListingProductSource) {
    if (!userId) return false;

    setGenerateLoading(true);
    try {
      const recommendedPrice =
        manualPriceOverride ?? pricingBreakdown?.recommendedPrice ?? undefined;

      const response = await fetch("/api/generate-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, product: sourceProduct, recommendedPrice }),
      });

      const data = await response.json();

      if (!response.ok) {
        setNotice(data.error ?? "Failed to generate listing.");
        setIsError(true);
        return false;
      }

      const nextProduct = data.product ?? sourceProduct;
      const nextListing = data.listing ?? null;

      setProduct(nextProduct);
      setListing(nextListing);

      if (nextListing) {
        const promotions = sellerPreferencesToPromotions(
          sellerPrefs ?? defaultSellerPreferences(),
        );
        const initial = buildInitialDraft(nextProduct, nextListing, {
          pricing: pricingPrefs ?? undefined,
          pricingBreakdown: pricingBreakdown ?? undefined,
          manualPriceOverride,
          promotions,
        });
        const withSkus = await assignInternalSkusToDraft(
          userId,
          nextProduct.productUrl,
          initial,
        );
        setDraft(withSkus);
      }

      setNotice("Listing generated. Review and edit before continuing.");
      setIsError(false);
      return true;
    } catch {
      setNotice("Network error while generating listing.");
      setIsError(true);
      return false;
    } finally {
      setGenerateLoading(false);
    }
  }

  function retryGenerateListing() {
    if (!product) return;
    generateStarted.current = false;
    setListing(null);
    setIsError(false);
    setNotice("");
    void generateListing(product);
  }

  useEffect(() => {
    if (currentStep !== 3 || !product || generateStarted.current || listing) return;
    generateStarted.current = true;
    void generateListing(product);
  }, [currentStep, product, listing]);

  function updateDraft(patch: Partial<ListingDraft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function updateListing(nextListing: GeneratedListing) {
    setListing(nextListing);
    setDraft((current) =>
      current
        ? {
            ...current,
            listing: { ...nextListing, brand: "Unbranded" },
          }
        : current,
    );
  }

  function handlePricingChange(
    prefs: ListingPricingPreferences,
    breakdown: PricingBreakdown,
    manualPrice: number | null,
  ) {
    setPricingPrefs(prefs);
    setPricingBreakdown(breakdown);
    setManualPriceOverride(manualPrice);

    if (draft) {
      setDraft(recalculateDraftPricing(draft, prefs, manualPrice));
    }
  }

  function validateStep(step: number): string | null {
    if (step === 0 && !url.trim()) return "Please paste an AliExpress product URL.";
    if (step === 1 && vero && !vero.safe && !veroAcknowledged)
      return "Acknowledge the VeRO risk to continue, or start a new listing.";
    if (step === 2 && !pricingBreakdown) return "Apply your pricing preferences before continuing.";
    if (step === 4) {
      if (!listing?.seoTitle.trim()) return "Title is required.";
      if (listing.seoTitle.length > 80) return "Title must be 80 characters or less.";
      if ((listing?.suggestedPrice ?? 0) <= 0) return "Price must be greater than 0.";
    }
    if (step === 5) {
      if (!draft?.photos.length) return "Add at least one photo.";
      for (const variant of draft?.variants ?? []) {
        if (variant.price <= 0) return "All variant prices must be greater than 0.";
        if (variant.quantity < 1) return "All variant quantities must be at least 1.";
        if (!variant.imageUrl) return "Each variant must have a photo.";
      }
    }
    if (step === 6) {
      if (!draft?.ebayPolicies?.fulfillmentPolicyId) return "Select a shipping policy.";
      if (!draft?.ebayPolicies?.paymentPolicyId) return "Select a payment policy.";
      if (!draft?.ebayPolicies?.returnPolicyId) return "Select a return policy.";
    }
    return null;
  }

  async function handleNext() {
    const error = validateStep(currentStep);
    if (error) {
      setNotice(error);
      setIsError(true);
      return;
    }

    setNotice("");
    setIsError(false);

    if (currentStep === 0) {
      setCurrentStep(1);
      await runVeroCheck();
      return;
    }

    if (currentStep === 1) {
      if (!vero?.safe && !veroAcknowledged) {
        setShowVeroModal(true);
        return;
      }
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      if (!pricingBreakdown) {
        setNotice("Click Apply pricing before continuing.");
        setIsError(true);
        return;
      }
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3 && generateLoading) return;

    if (currentStep === 7 && draft && userId && sellerPrefs) {
      const merged = promotionsToSellerPreferences(draft.promotions, sellerPrefs);
      try {
        await persistSellerPreferences(userId, merged);
        setSellerPrefs(merged);
        triggerSavedToast();
      } catch {
        // Auto-save may have already persisted; continue either way.
      }
    }

    setCurrentStep((step) => Math.min(step + 1, MAX_STEP));
  }

  function handleBack() {
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  async function resumeSavedDraft() {
    if (!userId || !resumeOffer) return;
    const response = await fetch(`/api/listings/drafts?userId=${encodeURIComponent(userId)}`);
    const data = await response.json();
    if (!response.ok || !data.draft?.draftJson) return;

    const saved = normalizeDraftVariants(data.draft.draftJson as ListingDraft);
    let resolvedDraft = saved;
    if (userId && draftNeedsSkuBackfill(saved)) {
      resolvedDraft = await assignInternalSkusToDraft(
        userId,
        saved.product.productUrl,
        saved,
      );
    }
    setUrl(data.draft.productUrl ?? "");
    setDraft(resolvedDraft);
    setProduct(resolvedDraft.product);
    setListing(resolvedDraft.listing);
    setPricingPrefs(saved.pricing ?? null);
    setPricingBreakdown(saved.pricingBreakdown ?? null);
    setManualPriceOverride(saved.manualPriceOverride ?? null);
    let step = data.draft.currentStep ?? 0;
    setCurrentStep(step);
    setResumeOffer(null);
    generateStarted.current = true;
  }

  async function handlePhotosVariantsSaveAndClose() {
    const error = validateStep(5);
    if (error) {
      setPhotosVariantsError(error);
      setNotice(error);
      setIsError(true);
      return;
    }
    setPhotosVariantsError(null);
    setNotice("");
    setIsError(false);
    await saveDraft();
    setCurrentStep(6);
  }

  async function handlePhotosVariantsSaveAndPreview(): Promise<boolean> {
    const error = validateStep(5);
    if (error) {
      setPhotosVariantsError(error);
      setNotice(error);
      setIsError(true);
      return false;
    }
    setPhotosVariantsError(null);
    setNotice("");
    setIsError(false);
    await saveDraft();
    return true;
  }

  const busy = veroLoading || generateLoading;
  const wizardStarted = currentStep > 0 || Boolean(vero) || Boolean(draft);
  const showConnectGate =
    !ebayStatusLoading &&
    !ebayStatus.connected &&
    !wizardStarted &&
    !resumeOffer;
  const showAddressSetup =
    ebayStatus.connected &&
    !ebayStatus.addressConfirmed &&
    Boolean(userId);

  function handleEbayDisconnected() {
    oauthJustSucceeded.current = false;
    setEbayStatus({
      connected: false,
      ebayUsername: null,
      accessTokenExpiresAt: null,
      addressConfirmed: false,
    });
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[960px] p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">AI Listing Generator</h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              Professional 9-step wizard to create optimized eBay listings from AliExpress.
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

        {ebayStatusLoading && !ebayStatus.connected && !isOAuthReturn && !isOAuthFailure ? (
          <div className="flex justify-center py-16">
            <svg
              className="h-8 w-8 animate-spin text-brand"
              viewBox="0 0 24 24"
              fill="none"
              aria-label="Loading"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        ) : showConnectGate && userId ? (
          <EbayStoreConnectGate userId={userId} errorMessage={isError ? notice : undefined} />
        ) : (
          <>
            {ebayStatus.connected && userId ? (
              <EbayConnectedBanner
                userId={userId}
                ebayUsername={ebayStatus.ebayUsername}
                addressConfirmed={ebayStatus.addressConfirmed}
                onDisconnected={handleEbayDisconnected}
                onAddressUpdated={() => void loadEbayStatus()}
              />
            ) : null}

            {showAddressSetup ? (
              <div className="mb-6">
                <EbayAddressSetupForm
                  userId={userId!}
                  mode="setup"
                  onComplete={() => void loadEbayStatus()}
                />
              </div>
            ) : null}

            {resumeOffer && !wizardStarted ? (
          <div className="mb-6 rounded-xl border border-brand/20 bg-brand-light/30 p-4">
            <p className="text-sm text-[#374151]">You have a listing in progress.</p>
            <button
              type="button"
              onClick={() => void resumeSavedDraft()}
              className="mt-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Resume listing
            </button>
          </div>
        ) : null}

        {wizardStarted ? <ListingWizardProgress currentStep={currentStep} /> : null}

        {currentStep === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">Start New Listing</h2>
            <label className="mt-4 block text-sm font-medium text-[#111827]">
              AliExpress Product URL
              <input
                type="url"
                value={url}
                disabled={isBlocked || busy}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.aliexpress.com/item/..."
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand disabled:opacity-60"
              />
            </label>
          </div>
        ) : null}

        <div className="mt-6 space-y-6">
          {currentStep === 1 ? <VeroChecker result={vero} loading={veroLoading} /> : null}

          {currentStep === 2 && product && userId ? (
            <ListingProfitCalculatorStep
              userId={userId}
              product={product}
              preferences={pricingPrefs}
              manualPriceOverride={manualPriceOverride}
              sellerPreferences={sellerPrefs}
              sellerPreferencesLoading={sellerPrefsLoading}
              onChange={handlePricingChange}
              onSellerPreferencesChange={setSellerPrefs}
              onSaved={triggerSavedToast}
            />
          ) : null}

          {currentStep === 3 ? (
            <AiListingGenerator
              userId={userId ?? ""}
              product={product}
              listing={listing}
              loading={generateLoading}
              errorMessage={isError && currentStep === 3 ? notice : undefined}
              onRetry={retryGenerateListing}
              onListingChange={updateListing}
            />
          ) : null}

          {currentStep === 4 && userId && listing ? (
            <AiListingGenerator
              userId={userId}
              product={product}
              listing={listing}
              loading={false}
              onListingChange={updateListing}
              descriptionPhotos={draft?.descriptionPhotos}
            />
          ) : null}

          {currentStep === 5 && draft ? (
            <ListingPhotosVariantsStep
              draft={draft}
              onChange={updateDraft}
              onSaveAndClose={() => handlePhotosVariantsSaveAndClose()}
              onSaveAndPreview={() => handlePhotosVariantsSaveAndPreview()}
              onCancel={() => setCurrentStep(4)}
              validationError={photosVariantsError}
            />
          ) : null}

          {currentStep === 6 && draft && userId ? (
            <ListingShippingReturnsStep
              userId={userId}
              draft={draft}
              onChange={updateDraft}
            />
          ) : null}

          {currentStep === 7 && draft && userId && sellerPrefs ? (
            <ListingPromotionsStep
              userId={userId}
              promotions={draft.promotions}
              sellerPreferences={sellerPrefs}
              onChange={(promotions) => updateDraft({ promotions })}
              onSellerPreferencesChange={setSellerPrefs}
              onSaved={triggerSavedToast}
            />
          ) : null}

          {currentStep === 8 && draft ? <ListingQualityScoreStep draft={draft} /> : null}

          {currentStep === 9 && draft && userId ? (
            <>
              <EbayConnect userId={userId} refreshKey={oauthRefreshKey} />
              <ListingConfirmStep
                userId={userId}
                draft={draft}
                disabled={isBlocked}
                addressConfirmed={ebayStatus.addressConfirmed}
                onListed={setListedUrl}
              />
            </>
          ) : null}

          {notice ? (
            <p
              className={`rounded-lg px-4 py-3 text-sm font-medium ${
                isError
                  ? "border border-red-100 bg-red-50 text-red-600"
                  : "border border-emerald-100 bg-emerald-50 text-emerald-700"
              }`}
            >
              {notice}
            </p>
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

        {currentStep < MAX_STEP && currentStep !== 5 ? (
          <ListingWizardNav
            currentStep={currentStep}
            maxStep={MAX_STEP}
            onBack={handleBack}
            onNext={() => void handleNext()}
            nextDisabled={busy || (currentStep === 3 && generateLoading)}
            nextLabel={currentStep === 0 ? "Check & Generate Listing" : "Next"}
            hideNext={currentStep === 1 && Boolean(vero && !vero.safe) && !veroAcknowledged}
          />
        ) : null}
          </>
        )}
      </div>

      {showVeroModal && vero && !vero.safe ? (
        <VeroBlockModal
          result={vero}
          onProceed={handleVeroAcknowledgeProceed}
          onStartNew={() => {
            setShowVeroModal(false);
            resetWizard();
          }}
        />
      ) : null}

      {showSavedToast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 shadow-lg">
          Saved ✓
        </div>
      ) : null}

      {showEbayConnectedToast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 shadow-lg">
          Successfully connected to eBay ✓
        </div>
      ) : null}
    </DashboardLayout>
  );
}
