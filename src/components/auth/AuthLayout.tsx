import Link from "next/link";
import { Logo, LogoIcon } from "@/components/landing/Logo";

const perks = [
  "7-day free trial — no credit card required",
  "Product research & competitor analysis",
  "Real-time price alerts & store tracking",
  "Trusted by 10,000+ e-commerce sellers",
];

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <aside className="relative hidden w-[44%] overflow-hidden bg-gradient-to-br from-brand via-[#6D28D9] to-[#3B82F6] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

        <Link href="/" className="relative z-10 flex items-center gap-2.5">
          <LogoIcon size={36} />
          <span className="text-xl font-bold text-white">EcomTools</span>
        </Link>

        <div className="relative z-10">
          <h1 className="text-3xl font-bold leading-tight text-white xl:text-4xl">
            Start growing your e-commerce business today
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-indigo-100">
            Join thousands of sellers using EcomTools to find winning products,
            track competitors, and scale faster.
          </p>

          <ul className="mt-10 space-y-4">
            {perks.map((perk) => (
              <li key={perk} className="flex items-start gap-3 text-sm text-white/90">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <path
                      d="M2.5 6l2.5 2.5 4.5-5"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-sm text-indigo-200/80">
          © {new Date().getFullYear()} EcomTools. All rights reserved.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 lg:hidden">
          <Link href="/">
            <Logo />
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-[#6B7280] hover:text-[#111827]"
          >
            Back to home
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  );
}
