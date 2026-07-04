"use client";

import { useState } from "react";

function PracticeProductImage({
  src,
  fallbackSeed,
  alt,
  className,
}: {
  src: string;
  fallbackSeed: string;
  alt: string;
  className?: string;
}) {
  const fallback = `https://picsum.photos/seed/${fallbackSeed}/480/480`;
  const [url, setUrl] = useState(src);

  return (
    <img
      src={url}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => {
        if (url !== fallback) setUrl(fallback);
      }}
      className={className}
    />
  );
}

const liveStreams = [
  { time: "Jul 4 3:00 AM", title: "Cardryx Collectibles", subtitle: "Pokémon Singles", host: "Pokémon - Rip & Ship", tone: "from-violet-900 to-purple-700" },
  { time: "Jul 4 5:00 AM", title: "Grab Your Bargains", subtitle: "Live deals", host: "General - Bargains", tone: "from-rose-900 to-pink-700" },
  { time: "Jul 4 7:00 AM", title: "Simi & Lola", subtitle: "Made in Italy", host: "Women's - Handbags", tone: "from-amber-100 to-orange-200 text-gray-800" },
  { time: "Jul 4 9:00 AM", title: "Trading Cards", subtitle: "Box breaks", host: "Collectibles - Cards", tone: "from-slate-700 to-slate-900" },
  { time: "Jul 4 11:00 AM", title: "Lorcana", subtitle: "Archazia's Island", host: "Trading Cards - Lorcana", tone: "from-sky-900 to-cyan-800" },
  { time: "Jul 4 1:00 PM", title: "Farrington's Wholesale", subtitle: "Bulk deals", host: "Wholesale - Mixed", tone: "from-emerald-800 to-teal-700" },
];

const topDeals = [
  {
    label: "Up to 50% off garden furniture",
    image: "https://picsum.photos/id/582/320/320",
    seed: "garden-furniture",
  },
  {
    label: "Shop football season",
    image: "https://picsum.photos/id/367/320/320",
    seed: "football-season",
  },
  {
    label: "Live shopping",
    liveBadge: true,
  },
  {
    label: "Shop local, sell local",
    image: "https://picsum.photos/id/291/320/320",
    seed: "shop-local",
  },
  {
    label: "Authenticity Guarantee",
    image: "https://picsum.photos/id/488/320/320",
    seed: "authenticity-shoe",
  },
  {
    label: "Shop deals",
    image: "https://picsum.photos/id/96/320/320",
    seed: "shop-deals-tech",
  },
  {
    label: "Sell for free",
    image: "https://picsum.photos/id/628/320/320",
    seed: "sell-for-free",
  },
];

const featuredDeals = [
  {
    title: "Roborock Qrevo S5V Robot Vacuum and Mop, FlexiArm Edge Mopping",
    price: "£289.00",
    badge: "20% off coupon available",
    image: "https://picsum.photos/id/449/480/480",
    seed: "robot-vacuum",
  },
  {
    title: "Evergreen 4-in-1 Complete 4-in-1 Lawn Feed Weed and Moss - 400 m2",
    price: "£47.49",
    badge: null,
    image: "https://picsum.photos/id/119/480/480",
    seed: "lawn-feed",
  },
  {
    title: "Mens Cargo Combat Work Trouser Multi Pocket Stretch Workwear",
    price: "£14.99",
    badge: null,
    image: "https://picsum.photos/id/452/480/480",
    seed: "cargo-trousers",
  },
  {
    title: "135Ah 12V Deep Cycle Leisure Battery for Motorhome Caravan",
    price: "£74.95",
    badge: "10% off coupon available",
    image: "https://picsum.photos/id/180/480/480",
    seed: "leisure-battery",
  },
  {
    title: "Lacoste Men's Cargo Shorts - Black",
    price: "£25.99",
    badge: null,
    image: "https://picsum.photos/id/399/480/480",
    seed: "cargo-shorts",
  },
  {
    title: "Mountain Warehouse Path Waterproof Mens Walking Shoes",
    price: "£25.99",
    badge: null,
    image: "https://picsum.photos/id/482/480/480",
    seed: "walking-shoes",
  },
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
          <h2 className="mb-4 text-[1.75rem] font-bold tracking-tight">This week&apos;s top deals</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {topDeals.map((deal) => (
              <button
                key={deal.label}
                type="button"
                className="group text-left"
              >
                <div className="mb-2 aspect-square overflow-hidden rounded-xl bg-[#ececec] p-2">
                  {"liveBadge" in deal && deal.liveBadge ? (
                    <div className="flex h-full w-full flex-col items-center justify-center rounded-lg bg-[#3ea44c] text-white">
                      <span className="text-3xl">📡</span>
                      <span className="mt-1 text-sm font-bold tracking-wide">LIVE</span>
                    </div>
                  ) : (
                    <PracticeProductImage
                      src={deal.image ?? ""}
                      fallbackSeed={deal.seed ?? deal.label}
                      alt={deal.label}
                      className="h-full w-full rounded-lg object-contain transition group-hover:scale-[1.02]"
                    />
                  )}
                </div>
                <p className="text-sm leading-snug text-[#191919] group-hover:underline">
                  {deal.label}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* ── Section 3: featured deals + banner + footer (photo 3) ── */}
        <section>
          <h2 className="text-2xl font-bold">Featured Deals</h2>
          <p className="mb-5 text-sm text-[#555]">All with free postage</p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {featuredDeals.map((deal) => (
              <div key={deal.title} className="overflow-hidden rounded-lg bg-white">
                <div className="relative aspect-square bg-white p-2">
                  <PracticeProductImage
                    src={deal.image}
                    fallbackSeed={deal.seed}
                    alt={deal.title}
                    className="h-full w-full object-contain"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-base text-[#555] shadow-sm"
                    aria-label="Save item"
                  >
                    ♡
                  </button>
                  {deal.badge ? (
                    <span className="absolute bottom-0 left-0 right-0 bg-[#3665f3] px-2 py-1.5 text-center text-[11px] font-semibold leading-tight text-white">
                      {deal.badge}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-1 px-2 pb-3 pt-2">
                  <p className="line-clamp-2 text-sm leading-snug text-[#191919]">{deal.title}</p>
                  <p className="text-base font-bold text-[#191919]">{deal.price}</p>
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
