import type { HandlingProduct } from "@/types/handling";

function scheduleLabel(product: HandlingProduct): string {
  if (product.updateMode === "auto_24h") return "Updates every 24 hours";
  if (product.updateMode === "custom") {
    return `Updates every ${product.updateIntervalHours ?? "—"} hours`;
  }
  return "Manual updates";
}

export function HandlingProductCard({
  product,
  onCheck,
  onRemove,
  checking,
}: {
  product: HandlingProduct;
  onCheck: () => void;
  onRemove: () => void;
  checking: boolean;
}) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-brand/20 hover:shadow-md">
      <div className="mb-4 flex items-start gap-3">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.title}
            className="h-16 w-16 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand text-xs">
            No image
          </div>
        )}
        <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand">
          {scheduleLabel(product)}
        </span>
      </div>

      <h3 className="mb-3 line-clamp-2 text-base font-bold text-[#111827]">
        <a
          href={product.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-brand hover:underline"
        >
          {product.title}
        </a>
      </h3>

      <div className="mb-4 grid grid-cols-3 gap-2 border-t border-gray-50 pt-4">
        <div>
          <p className="text-[10px] font-medium uppercase text-[#9CA3AF]">Price</p>
          <p className="text-sm font-bold text-[#111827]">{product.price}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase text-[#9CA3AF]">Stock</p>
          <p className="text-sm font-bold text-[#111827]">{product.stock ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase text-[#9CA3AF]">Orders</p>
          <p className="text-sm font-bold text-[#111827]">{product.orders ?? "—"}</p>
        </div>
      </div>

      <p className="text-xs text-[#9CA3AF]">
        Last checked {product.lastCheckedAt ?? "never"}
      </p>

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {product.updateMode === "manual" && (
          <button
            type="button"
            onClick={onCheck}
            disabled={checking}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {checking ? "Checking..." : "Check update"}
          </button>
        )}
        <a
          href={product.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-xl border border-brand/20 bg-brand-light px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand/10"
        >
          View on AliExpress
        </a>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100"
        >
          Remove
        </button>
      </div>
    </article>
  );
}
