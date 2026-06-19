"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { useUserBlock } from "@/features/dashboard/context/UserBlockContext";
import { AiListingGenerator } from "./AiListingGenerator";
import { EbayConnect } from "./EbayConnect";
import { VeroChecker } from "./VeroChecker";
import type { GeneratedListing, ListingProductSource, VeroCheckResult } from "@/types/listing-generator";

export function ListingsShell() {
  const searchParams = useSearchParams();
  const { isBlocked } = useUserBlock();

  const [userId, setUserId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [product, setProduct] = useState<ListingProductSource | null>(null);
  const [listing, setListing] = useState<GeneratedListing | null>(null);
  const [vero, setVero] = useState<VeroCheckResult | null>(null);
  const [veroLoading, setVeroLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
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

  async function handleRunFlow() {
    if (!userId) return;

    if (!url.trim()) {
      setNotice("Please paste an AliExpress product URL.");
      setIsError(true);
      return;
    }

    setNotice("");
    setIsError(false);
    setProduct(null);
    setListing(null);
    setVero(null);
    setListedUrl(null);
    setVeroLoading(true);

    try {
      const veroResponse = await fetch("/api/vero-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, url: url.trim() }),
      });

      const veroData = await veroResponse.json();

      if (!veroResponse.ok) {
        setNotice(veroData.error ?? "VeRO check failed.");
        setIsError(true);
        return;
      }

      setProduct(veroData.product ?? null);
      setVero(veroData.vero ?? null);

      if (!veroData.vero?.safe) {
        setNotice("Listing generation skipped because the product failed the VeRO safety check.");
        setIsError(true);
        return;
      }

      setVeroLoading(false);
      setGenerateLoading(true);

      const listingResponse = await fetch("/api/generate-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, url: url.trim() }),
      });

      const listingData = await listingResponse.json();

      if (!listingResponse.ok) {
        setNotice(listingData.error ?? "Failed to generate listing.");
        setIsError(true);
        return;
      }

      setProduct(listingData.product ?? veroData.product ?? null);
      setListing(listingData.listing ?? null);
      setNotice("eBay listing generated successfully.");
      setIsError(false);
    } catch {
      setNotice("Network error while processing the product.");
      setIsError(true);
    } finally {
      setVeroLoading(false);
      setGenerateLoading(false);
    }
  }

  const busy = veroLoading || generateLoading;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[960px] p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#111827]">AI Listing Generator</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Paste an AliExpress URL, run a VeRO safety check, and generate an eBay-ready listing.
          </p>
        </div>

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
            onClick={() => void handleRunFlow()}
            className="mt-4 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Processing..." : "Check & Generate Listing"}
          </button>

          {notice ? (
            <p className={`mt-3 text-sm ${isError ? "text-red-600" : "text-emerald-700"}`}>
              {notice}
            </p>
          ) : null}
        </div>

        <div className="mt-6 space-y-6">
          <VeroChecker result={vero} loading={veroLoading} />
          <AiListingGenerator product={product} listing={listing} loading={generateLoading} />

          {userId ? (
            <EbayConnect
              userId={userId}
              listing={listing}
              product={product}
              veroSafe={Boolean(vero?.safe)}
              disabled={isBlocked}
              onListed={setListedUrl}
            />
          ) : null}

          {listedUrl ? (
            <p className="text-sm text-brand">
              <a href={listedUrl} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                View listing on eBay
              </a>
            </p>
          ) : null}
        </div>
      </div>
    </DashboardLayout>
  );
}
