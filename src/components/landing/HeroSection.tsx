import { CTAButton } from "./CTAButton";
import { DashboardPreview } from "./DashboardPreview";

function CheckBadge() {
  return (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-light">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path
          d="M2.5 6l2.5 2.5 4.5-5"
          stroke="#5842F4"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function UsersBadge() {
  return (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-light">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <circle cx="4.5" cy="4" r="2" stroke="#5842F4" strokeWidth="1.2" />
        <path d="M1 10.5c0-2 1.6-3 3.5-3s3.5 1 3.5 3" stroke="#5842F4" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white pb-20 pt-14 lg:pb-28 lg:pt-20">
      {/* Background glow */}
      <div className="pointer-events-none absolute right-0 top-0 h-[600px] w-[600px] translate-x-1/4 rounded-full bg-gradient-to-bl from-[#5842F4]/12 via-[#A78BFA]/8 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -left-32 top-32 h-64 w-64 rounded-full bg-[#5842F4]/5 blur-3xl" />

      <div className="relative mx-auto grid max-w-[1280px] items-center gap-12 px-6 lg:grid-cols-2 lg:gap-10 lg:px-10">
        {/* Left */}
        <div className="max-w-xl">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#DDD6FE] bg-brand-light px-3.5 py-1.5 text-xs font-semibold text-brand">
            <span aria-hidden>✨</span>
            All-in-One E-commerce Growth Platform
          </span>

          <h1 className="text-[2.5rem] font-bold leading-[1.12] tracking-tight text-[#111827] sm:text-5xl lg:text-[3.25rem]">
            Everything you need to grow your{" "}
            <span className="text-brand">e-commerce business.</span>
          </h1>

          <p className="mt-5 text-base leading-relaxed text-[#6B7280] sm:text-[17px] sm:leading-7">
            EcomTools helps you find winning products, analyze competitors,
            track sales, and scale your store – all from one powerful dashboard.
          </p>

          <div className="mt-8">
            <CTAButton size="lg" />
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="flex items-center gap-2.5">
              <CheckBadge />
              <div>
                <p className="text-sm font-semibold text-[#111827]">7-Day Free Trial</p>
                <p className="text-xs text-[#6B7280]">No credit card required</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <UsersBadge />
              <div>
                <p className="text-sm font-semibold text-[#111827]">Trusted by 10,000+</p>
                <p className="text-xs text-[#6B7280]">E-commerce sellers</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="relative lg:-mr-4 xl:-mr-8">
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}
