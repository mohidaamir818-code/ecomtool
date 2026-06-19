"use client";

import type { GeneratedListing, ListingProductSource } from "@/types/listing-generator";

interface AiListingGeneratorProps {
  product: ListingProductSource | null;
  listing: GeneratedListing | null;
  loading?: boolean;
}

function formatPrice(price: number, currency: string): string {
  if (currency === "GBP") return `£${price.toFixed(2)}`;
  if (currency === "USD") return `$${price.toFixed(2)}`;
  if (currency === "EUR") return `€${price.toFixed(2)}`;
  return `${currency} ${price.toFixed(2)}`;
}

export function AiListingGenerator({ product, listing, loading = false }: AiListingGeneratorProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-sm text-[#6B7280]">Generating eBay listing with AI...</p>
      </div>
    );
  }

  if (!product || !listing) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-sm text-[#6B7280]">
        Paste an AliExpress URL and run the VeRO check to generate your eBay listing.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-[#111827]">Source product</h2>
        <div className="mt-4 flex gap-4">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.title}
              className="h-24 w-24 rounded-lg border border-gray-100 object-cover"
            />
          ) : null}
          <div className="min-w-0">
            <p className="font-medium text-[#111827]">{product.title}</p>
            <p className="mt-1 text-sm text-[#6B7280]">
              Cost: {formatPrice(product.price, product.currency)}
            </p>
            <p className="mt-1 line-clamp-3 text-sm text-[#6B7280]">{product.description}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-[#111827]">Generated eBay listing</h2>

        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">SEO title</p>
            <p className="mt-1 text-sm font-medium text-[#111827]">
              {listing.seoTitle}{" "}
              <span className="text-[#9CA3AF]">({listing.seoTitle.length}/80)</span>
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
              Suggested price
            </p>
            <p className="mt-1 text-sm font-medium text-[#111827]">
              {formatPrice(listing.suggestedPrice, listing.currency)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Category</p>
            <p className="mt-1 text-sm text-[#374151]">{listing.categorySuggestion}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
              Item specifics
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {listing.itemSpecifics.map((specific) => (
                <span
                  key={`${specific.name}-${specific.value}`}
                  className="rounded-full bg-gray-100 px-3 py-1 text-xs text-[#374151]"
                >
                  {specific.name}: {specific.value}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
              Description preview
            </p>
            <div
              className="prose prose-sm mt-2 max-w-none rounded-lg border border-gray-100 bg-gray-50 p-4 text-[#374151]"
              dangerouslySetInnerHTML={{ __html: listing.descriptionHtml }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
