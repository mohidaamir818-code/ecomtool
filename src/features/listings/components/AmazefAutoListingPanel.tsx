"use client";

interface AmazefAutoListingPanelProps {
  enabled: boolean;
  processing?: boolean;
  onToggle: (enabled: boolean) => void;
  onEditSettings: () => void;
}

export function AmazefAutoListingPanel({
  enabled,
  processing = false,
  onToggle,
  onEditSettings,
}: AmazefAutoListingPanelProps) {
  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#111827]">Auto listing</h3>
          <p className="mt-1 text-xs text-[#6B7280]">
            Paste a URL only — AI handles VeRO, profit, listing, stock, shipping, and publishes to
            Amazef.
          </p>
          {enabled ? (
            <p className="mt-2 text-xs font-medium text-violet-800">
              Active{processing ? " · listing in progress…" : " · paste URL and click Auto list"}
            </p>
          ) : null}
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <span className="text-xs font-semibold text-[#374151]">Auto listing</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={processing}
            onClick={() => onToggle(!enabled)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              enabled ? "bg-brand" : "bg-gray-300"
            } ${processing ? "opacity-60" : ""}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-5" : ""
              }`}
            />
          </button>
        </label>
      </div>

      {enabled ? (
        <button
          type="button"
          onClick={onEditSettings}
          disabled={processing}
          className="mt-3 text-xs font-semibold text-brand hover:underline disabled:opacity-60"
        >
          Edit auto listing settings
        </button>
      ) : null}
    </div>
  );
}
