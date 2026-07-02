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
                Manage your account, security, and daily request limits.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Account Settings
            </span>
          </div>
        </header>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <DashboardIcon name="settings" className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-semibold text-[#111827]">Profile & Security</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Email Address
              </span>
              <input
                type="email"
                defaultValue="seller@example.com"
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-brand"
              />
              <p className="mt-2 text-xs text-[#6B7280]">
                Update your account email for login and notifications.
              </p>
            </label>

            <label className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Password
              </span>
              <input
                type="password"
                defaultValue="********"
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-brand"
              />
              <p className="mt-2 text-xs text-[#6B7280]">
                Change your password regularly to keep account secure.
              </p>
            </label>

            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Daily Requests
              </span>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
                <div className="h-full w-[38%] rounded-full bg-brand" />
              </div>
              <p className="mt-2 text-sm font-medium text-[#111827]">1,900 / 5,000 used today</p>
              <p className="mt-1 text-xs text-[#6B7280]">
                Daily request usage resets automatically every 24 hours.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Save Changes
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-gray-50"
            >
              Change Password
            </button>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
