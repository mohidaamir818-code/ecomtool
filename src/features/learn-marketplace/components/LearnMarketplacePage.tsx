"use client";

const liveStreams = [
  { time: "Jul 4 3:00 AM", title: "Cardryx Collectibles", subtitle: "Pokémon Singles", host: "Pokémon - Rip & Ship", tone: "from-violet-900 to-purple-700" },
  { time: "Jul 4 5:00 AM", title: "Grab Your Bargains", subtitle: "Live deals", host: "General - Bargains", tone: "from-rose-900 to-pink-700" },
  { time: "Jul 4 7:00 AM", title: "Simi & Lola", subtitle: "Made in Italy", host: "Women's - Handbags", tone: "from-amber-100 to-orange-200 text-gray-800" },
  { time: "Jul 4 9:00 AM", title: "Trading Cards", subtitle: "Box breaks", host: "Collectibles - Cards", tone: "from-slate-700 to-slate-900" },
  { time: "Jul 4 11:00 AM", title: "Lorcana", subtitle: "Archazia's Island", host: "Trading Cards - Lorcana", tone: "from-sky-900 to-cyan-800" },
  { time: "Jul 4 1:00 PM", title: "Farrington's Wholesale", subtitle: "Bulk deals", host: "Wholesale - Mixed", tone: "from-emerald-800 to-teal-700" },
];

const topDeals = [
  { label: "Up to 50% off garden furniture", emoji: "🪑" },
  { label: "Shop football season", emoji: "⚽" },
  { label: "Live shopping", emoji: "📺" },
  { label: "Shop local, sell local", emoji: "📦" },
  { label: "Authenticity Guarantee", emoji: "👟" },
  { label: "Shop deals", emoji: "🎮" },
  { label: "Sell for free", emoji: "👕" },
];

const featuredDeals = [
  { title: "Premium appliance bundle with free postage", price: "£209.00", badge: "20% off coupon available", tone: "bg-slate-200" },
  { title: "Household cleaning liquid pack", price: "£43.49", badge: null, tone: "bg-sky-100" },
  { title: "Men's tailored trousers", price: "£29.99", badge: null, tone: "bg-gray-200" },
  { title: "Portable power station", price: "£189.00", badge: "10% off coupon available", tone: "bg-zinc-300" },
  { title: "Athletic shorts collection", price: "£18.50", badge: null, tone: "bg-stone-200" },
  { title: "Running shoes - multiple sizes", price: "£54.00", badge: null, tone: "bg-neutral-300" },
];

const navCategories = [
  "Live",
  "Saved",
  "Home",
  "Garden & DIY",
  "Electronics",
  "Refurbished",
  "Clothing & accessories",
  "Jewellery & watches",
  "Motors",
  "Collectables",
  "Sports & leisure",
  "Health & Beauty",
  "Small Business",
];

export function LearnMarketplacePage() {
  return (
    <div className="min-h-full bg-[#f7f7f7] text-[#111827]">
      {/* ── Section 1: header + hero (photo 1) ── */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-2 text-xs text-[#555]">
          <div className="flex flex-wrap gap-4">
            <span>Hello. Sign in or register</span>
            <span>Daily Deals</span>
            <span>Fashion</span>
            <span>Help & Contact</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <span>Sell</span>
            <span>Watchlist</span>
            <span>My Account</span>
          </div>
        </div>

        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-4 px-4 py-4">
          <div className="text-3xl font-bold tracking-tight">
            <span className="text-[#e53238]">m</span>
            <span className="text-[#0064d2]">a</span>
            <span className="text-[#f5af02]">r</span>
            <span className="text-[#86b817]">k</span>
            <span className="text-[#e53238]">e</span>
            <span className="text-[#0064d2]">t</span>
          </div>

          <div className="flex min-w-[280px] flex-1 items-stretch overflow-hidden rounded-full border-2 border-[#191919]">
            <button type="button" className="border-r border-gray-300 px-4 text-sm text-[#555]">
              Shop by category ▾
            </button>
            <input
              readOnly
              placeholder="Search for anything"
              className="min-w-0 flex-1 px-4 text-sm outline-none"
            />
            <select className="border-l border-gray-300 px-3 text-sm text-[#555] outline-none">
              <option>All Categories</option>
            </select>
            <button type="button" className="bg-[#3665f3] px-8 text-sm font-semibold text-white">
              Search
            </button>
          </div>

          <span className="text-sm text-[#3665f3]">Advanced</span>
        </div>

        <div className="mx-auto max-w-[1400px] overflow-x-auto px-4 pb-3">
          <div className="flex gap-5 whitespace-nowrap text-sm text-[#555]">
            {navCategories.map((item) => (
              <span key={item} className="cursor-default hover:text-[#3665f3]">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#191919] px-6 py-5 text-white">
          <p className="max-w-3xl text-lg font-semibold">
            Massive wins await. Tap into Live to score the things you love in real time.
          </p>
          <button type="button" className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-[#191919]">
            Tune in
          </button>
        </div>

        <div className="relative overflow-hidden rounded-xl bg-[#ccebff] px-6 py-8">
          <div className="max-w-xl">
            <h2 className="text-3xl font-bold leading-tight text-[#191919]">
              Score 10% off your next find
            </h2>
            <p className="mt-2 text-lg text-[#191919]">
              Even better, save an extra 5% with store balance. Select sellers.
            </p>
            <button type="button" className="mt-5 rounded-full bg-[#191919] px-6 py-2.5 text-sm font-semibold text-white">
              Use code: BOOSTPLUS
            </button>
          </div>
          <div className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 gap-4 md:flex">
            <div className="h-28 w-44 rounded-xl bg-white/70 shadow" />
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#3665f3] text-center text-sm font-bold text-white">
              10%
              <br />
              OFF
            </div>
          </div>
        </div>

        {/* ── Section 2: live + top deals (photo 2) ── */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Live shopping</h2>
              <p className="text-sm text-[#555]">Tune in and shop curated experiences</p>
            </div>
            <button type="button" className="text-sm font-semibold text-[#3665f3]">
              See all
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {liveStreams.map((stream) => (
              <div key={stream.title} className="overflow-hidden rounded-xl bg-white shadow-sm">
                <div className={`relative h-44 bg-gradient-to-br ${stream.tone} p-3`}>
                  <span className="inline-flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-[11px] text-white">
                    🕐 {stream.time}
                  </span>
                  <div className="absolute inset-x-3 bottom-3">
                    <p className="text-sm font-bold">{stream.title}</p>
                    <p className="text-xs opacity-80">{stream.subtitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs">
                    👤
                  </div>
                  <p className="text-xs text-[#555]">{stream.host}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-5 text-2xl font-bold">This week&apos;s top deals</h2>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {topDeals.map((deal) => (
              <div key={deal.label} className="text-center">
                <div className="mx-auto mb-3 flex h-28 w-28 items-center justify-center rounded-full bg-white text-4xl shadow-sm">
                  {deal.emoji}
                </div>
                <p className="text-sm font-medium leading-snug text-[#191919]">{deal.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 3: featured deals + banner + footer (photo 3) ── */}
        <section>
          <h2 className="text-2xl font-bold">Featured Deals</h2>
          <p className="mb-5 text-sm text-[#555]">All with free postage</p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {featuredDeals.map((deal) => (
              <div key={deal.title} className="overflow-hidden rounded-xl bg-white shadow-sm">
                <div className={`relative h-44 ${deal.tone}`}>
                  <button type="button" className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-sm">
                    ♡
                  </button>
                  {deal.badge ? (
                    <span className="absolute bottom-0 left-0 right-0 bg-[#3665f3] px-2 py-1 text-center text-[11px] font-semibold text-white">
                      {deal.badge}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-1 px-3 py-3">
                  <p className="line-clamp-2 text-sm">{deal.title}</p>
                  <p className="text-lg font-bold">{deal.price}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-6 overflow-hidden rounded-xl bg-[#3665f3] px-8 py-10 text-white">
          <div className="max-w-lg">
            <h2 className="text-3xl font-bold">Turn spare tech into cash</h2>
            <p className="mt-2 text-lg opacity-90">
              Buyers are hunting for consoles and games — sell yours today.
            </p>
            <button type="button" className="mt-5 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-[#3665f3]">
              Sell for free
            </button>
          </div>
          <div className="flex gap-3 text-5xl">
            <span>🎮</span>
            <span>🕹️</span>
            <span>📀</span>
          </div>
        </div>

        <footer className="rounded-xl bg-[#f0f0f0] px-6 py-8">
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-5">
            {[
              { heading: "Buy", links: ["Registration", "Stores", "Money Back Guarantee"] },
              { heading: "Sell", links: ["Start selling", "Learn to sell", "Affiliates"] },
              { heading: "Community", links: ["Announcements", "Answer centre", "Discussion boards"] },
              { heading: "About", links: ["Company info", "News", "Careers"] },
              { heading: "Help & Contact", links: ["Contact us", "Returns", "Security centre"] },
            ].map((col) => (
              <div key={col.heading}>
                <h3 className="mb-3 text-sm font-bold">{col.heading}</h3>
                <ul className="space-y-2 text-sm text-[#555]">
                  {col.links.map((link) => (
                    <li key={link}>{link}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-gray-300 pt-4 text-sm text-[#555]">
            <span>© 2026 Marketplace demo page for learning purposes</span>
            <span>🇬🇧 United Kingdom</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
