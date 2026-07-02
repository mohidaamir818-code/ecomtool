import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { DashboardIcon } from "./DashboardIcon";

export function SettingsShell() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1100px] space-y-6 p-6 lg:p-8">
        <header className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#111827]">Settings</h1>
              <p className="mt-1 text-sm text-[#6B7280]">
                Configure cache, sync behavior, and usage controls from one place.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Professional Mode
            </span>
          </div>
        </header>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <DashboardIcon name="settings" className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-semibold text-[#111827]">Smart Cache & Sync Control</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Cache Window
              </span>
              <select
                defaultValue="24"
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-brand"
              >
                <option value="12">12 hours</option>
                <option value="24">24 hours (recommended)</option>
                <option value="48">48 hours</option>
              </select>
              <p className="mt-2 text-xs text-[#6B7280]">
                Reuse cached AliExpress product data within selected duration.
              </p>
            </label>

            <label className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Auto Sync Frequency
              </span>
              <select
                defaultValue="24"
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-brand"
              >
                <option value="6">Every 6 hours</option>
                <option value="12">Every 12 hours</option>
                <option value="24">Every 24 hours (recommended)</option>
              </select>
              <p className="mt-2 text-xs text-[#6B7280]">
                One supplier call can update all linked sellers of same product.
              </p>
            </label>

            <label className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Overflow Strategy
              </span>
              <select
                defaultValue="official-first"
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-brand"
              >
                <option value="official-first">Official API first</option>
                <option value="cache-first">Cache first</option>
                <option value="fallback-scrape">Fallback scrape on limit</option>
              </select>
              <p className="mt-2 text-xs text-[#6B7280]">
                Control how the system behaves near request limits.
              </p>
            </label>

            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Alerts
              </span>
              <div className="mt-2 space-y-2 text-sm text-[#374151]">
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="h-4 w-4 accent-brand" />
                  Stock out alerts
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="h-4 w-4 accent-brand" />
                  Price jump alerts
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="h-4 w-4 accent-brand" />
                  Daily usage digest
                </label>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-brand/20 bg-brand-light/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#111827]">API Usage Guard</p>
                <p className="mt-1 text-xs text-[#6B7280]">
                  Requests today: <span className="font-semibold text-[#111827]">1,240 / 5,000</span>
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-brand/30 bg-white px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/5"
              >
                Force Refresh Selected
              </button>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
