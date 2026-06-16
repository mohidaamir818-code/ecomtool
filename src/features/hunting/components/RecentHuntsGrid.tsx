import type { HuntProduct, HuntRequest } from "@/types/hunting";
import { EmptyState } from "./EmptyState";
import { HuntProductCard } from "./HuntProductCard";

export function RecentHuntsGrid({
  products,
  lookbackDays,
  selectedRequest,
}: {
  products: HuntProduct[];
  lookbackDays: number;
  selectedRequest: HuntRequest | null;
}) {
  const isFiltered = selectedRequest != null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#111827]">
            {isFiltered ? "Selected Hunt Product" : "Top Hunt Products"}
          </h2>
          <p className="text-sm text-[#6B7280]">
            {isFiltered
              ? `Showing results for "${selectedRequest.keyword}" only.`
              : `Most sold product per hunt from the last ${lookbackDays} days.`}
          </p>
        </div>
        {products.length > 0 && (
          <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand">
            {products.length} product{products.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 8h16l-1.5 10H5.5L4 8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          }
          title={
            isFiltered
              ? "No product saved for this hunt"
              : `No hunted products in the last ${lookbackDays} days`
          }
          description={
            isFiltered
              ? "This hunt did not return a product, or it may still be processing."
              : "Run a hunt to fetch the most sold product from Amazef for your keyword and time range."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((hunt) => (
            <HuntProductCard key={hunt.id} hunt={hunt} />
          ))}
        </div>
      )}
    </div>
  );
}
