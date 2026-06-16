import { LogoIcon } from "./Logo";

const sidebarItems = [
  { label: "Overview", active: true, icon: "grid" },
  { label: "Product Research", icon: "search" },
  { label: "Competitor Analysis", icon: "chart" },
  { label: "Store Tracker", icon: "store" },
  { label: "Sales Analytics", icon: "analytics" },
  { label: "Marketing Tools", icon: "megaphone" },
  { label: "Real-time Alerts", icon: "bell" },
  { label: "Saved Products", icon: "bookmark" },
];

const stats = [
  { label: "Total Sales", value: "$98,765", change: "+12.5%", up: true },
  { label: "Orders", value: "2,456", change: "+8.2%", up: true },
  { label: "Profit", value: "$24,851", change: "+15.3%", up: true },
  { label: "ROI", value: "3.45x", change: "+0.8x", up: true },
];

const products = [
  { name: "Wireless Headphones", price: "$49.99", pct: "+32%", color: "bg-slate-200" },
  { name: "Smart Watch Series 8", price: "$89.99", pct: "+28%", color: "bg-slate-300" },
  { name: "LED Desk Lamp", price: "$29.99", pct: "+21%", color: "bg-slate-200" },
];

function SidebarIcon({ type }: { type: string }) {
  const cls = "h-3.5 w-3.5 shrink-0";
  switch (type) {
    case "grid":
      return (
        <svg className={cls} viewBox="0 0 14 14" fill="currentColor" aria-hidden>
          <rect x="1" y="1" width="5" height="5" rx="1" />
          <rect x="8" y="1" width="5" height="5" rx="1" />
          <rect x="1" y="8" width="5" height="5" rx="1" />
          <rect x="8" y="8" width="5" height="5" rx="1" />
        </svg>
      );
    case "search":
      return (
        <svg className={cls} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
          <circle cx="6" cy="6" r="4" />
          <path d="M9 9l3 3" strokeLinecap="round" />
        </svg>
      );
    default:
      return <span className={`${cls} rounded-sm bg-current opacity-40`} />;
  }
}

export function DashboardPreview() {
  return (
    <div className="relative">
      {/* Purple glow behind dashboard */}
      <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-gradient-to-br from-[#5842F4]/20 via-[#818CF8]/10 to-transparent blur-2xl" />
      <div className="pointer-events-none absolute -right-4 top-8 h-48 w-48 rounded-full bg-[#5842F4]/15 blur-3xl" />

      <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_24px_64px_rgba(88,66,244,0.12),0_8px_24px_rgba(0,0,0,0.06)]">
        <div className="flex min-h-[420px]">
          {/* Sidebar */}
          <aside className="hidden w-[168px] shrink-0 border-r border-gray-100 bg-[#FAFAFA] p-3 md:block">
            <div className="mb-5 flex items-center gap-2 px-2 pt-1">
              <LogoIcon size={22} />
              <span className="text-xs font-bold text-[#111827]">EcomTools</span>
            </div>
            <ul className="space-y-0.5">
              {sidebarItems.map((item) => (
                <li
                  key={item.label}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium ${
                    item.active
                      ? "bg-brand text-white shadow-sm"
                      : "text-[#6B7280]"
                  }`}
                >
                  <SidebarIcon type={item.icon} />
                  <span className="truncate">{item.label}</span>
                </li>
              ))}
            </ul>
          </aside>

          {/* Main */}
          <div className="min-w-0 flex-1 bg-white p-4 md:p-5">
            {/* Top bar */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[#111827]">Overview</h3>
              <div className="flex items-center gap-2">
                <div className="hidden h-8 w-32 items-center rounded-lg border border-gray-200 bg-gray-50 px-2.5 sm:flex">
                  <svg className="mr-1.5 h-3.5 w-3.5 text-gray-400" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
                    <circle cx="6" cy="6" r="4" />
                    <path d="M9 9l3 3" strokeLinecap="round" />
                  </svg>
                  <span className="text-[10px] text-gray-400">Search...</span>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white">
                  <svg className="h-4 w-4 text-gray-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
                    <path d="M8 2a4 4 0 014 4v1.5c0 .5.2 1 .5 1.4L13.5 11H2.5l1-2.1c.3-.4.5-.9.5-1.4V6a4 4 0 014-4z" strokeLinejoin="round" />
                    <path d="M6.5 13.5a1.5 1.5 0 003 0" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="h-8 w-8 overflow-hidden rounded-full bg-gradient-to-br from-brand to-blue-400" />
              </div>
            </div>

            {/* Stats */}
            <div className="mb-4 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-[10px] font-medium text-[#6B7280]">{stat.label}</p>
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-light">
                      <svg className="h-2.5 w-2.5 text-brand" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
                        <path d="M1 8V2h1.5v6H1zm2.5-2V4h1.5v2H3.5zm2.5-1.5V4h1.5v2.5H6zm2.5-2V2h1.5v4H8.5z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-base font-bold text-[#111827]">{stat.value}</p>
                  <p className={`mt-0.5 flex items-center gap-0.5 text-[10px] font-semibold ${stat.up ? "text-emerald-500" : "text-red-500"}`}>
                    <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
                      <path d="M5 2l3 4H2l3-4z" />
                    </svg>
                    {stat.change}
                  </p>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="mb-4 rounded-xl border border-gray-100 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#111827]">Sales Overview</span>
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-[#6B7280]">
                  Last 7 days
                </span>
              </div>
              <svg viewBox="0 0 480 100" className="h-24 w-full" preserveAspectRatio="none" aria-hidden>
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5842F4" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#5842F4" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,70 C30,65 50,45 80,50 C110,55 130,30 160,35 C190,40 210,55 240,40 C270,25 290,45 320,30 C350,15 380,40 410,25 C440,10 460,35 480,20 L480,100 L0,100 Z"
                  fill="url(#areaFill)"
                />
                <path
                  d="M0,70 C30,65 50,45 80,50 C110,55 130,30 160,35 C190,40 210,55 240,40 C270,25 290,45 320,30 C350,15 380,40 410,25 C440,10 460,35 480,20"
                  fill="none"
                  stroke="#5842F4"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
              <div className="mt-1 flex justify-between text-[10px] text-[#9CA3AF]">
                {["May 12", "May 13", "May 14", "May 15", "May 16", "May 17", "May 18"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
            </div>

            {/* Bottom */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="mb-3 text-xs font-semibold text-[#111827]">Top Winning Products</p>
                {products.map((p) => (
                  <div key={p.name} className="mb-2.5 flex items-center gap-2.5 last:mb-0">
                    <div className={`h-9 w-9 shrink-0 rounded-lg ${p.color}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-[#374151]">{p.name}</p>
                      <p className="text-[10px] text-[#9CA3AF]">{p.price}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-500">{p.pct}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="mb-3 text-xs font-semibold text-[#111827]">Traffic Source</p>
                <div className="flex items-center gap-3">
                  <svg viewBox="0 0 80 80" className="h-[72px] w-[72px] shrink-0" aria-hidden>
                    <circle cx="40" cy="40" r="32" fill="#F3F4F6" />
                    <path d="M40 8 A32 32 0 0 1 72 40 L40 40 Z" fill="#5842F4" />
                    <path d="M72 40 A32 32 0 0 1 40 72 L40 40 Z" fill="#F97316" />
                    <path d="M40 72 A32 32 0 0 1 8 40 L40 40 Z" fill="#FBBF24" />
                    <path d="M8 40 A32 32 0 0 1 40 8 L40 40 Z" fill="#60A5FA" />
                    <circle cx="40" cy="40" r="14" fill="white" />
                  </svg>
                  <div className="space-y-1.5 text-[10px] text-[#6B7280]">
                    <p><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#5842F4]" />Facebook <strong className="text-[#374151]">45%</strong></p>
                    <p><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#F97316]" />TikTok <strong className="text-[#374151]">28%</strong></p>
                    <p><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#60A5FA]" />Google <strong className="text-[#374151]">17%</strong></p>
                    <p><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#FBBF24]" />Other <strong className="text-[#374151]">10%</strong></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
