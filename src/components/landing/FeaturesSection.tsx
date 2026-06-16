import { CTAButton } from "./CTAButton";

const features = [
  {
    title: "Product Research",
    description:
      "Find winning products with high demand and low competition.",
    iconBg: "bg-[#EDE9FE]",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
        <rect x="4" y="6" width="14" height="16" rx="2" stroke="#5842F4" strokeWidth="1.5" />
        <path d="M8 11h8M8 15h5" stroke="#5842F4" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="19" cy="19" r="5" stroke="#5842F4" strokeWidth="1.5" />
        <path d="M22 22l2.5 2.5" stroke="#5842F4" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Competitor Analysis",
    description:
      "Spy on competitors and discover their top performing products.",
    iconBg: "bg-[#FFEDD5]",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
        <rect x="4" y="4" width="14" height="14" rx="2" stroke="#F97316" strokeWidth="1.5" />
        <path d="M8 14V10M12 14V7M16 14V11" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="19" cy="19" r="5" stroke="#F97316" strokeWidth="1.5" />
        <circle cx="19" cy="19" r="2" fill="#F97316" />
      </svg>
    ),
  },
  {
    title: "Real-time Alerts",
    description:
      "Get notified about winning products and store updates.",
    iconBg: "bg-[#FEF3C7]",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
        <path
          d="M14 4a5 5 0 00-5 5v3c0 .9-.3 1.7-.9 2.4L5.5 17.5A1.2 1.2 0 006.5 19.5h15a1.2 1.2 0 001-1.9l-2.6-3.1a3.5 3.5 0 01-.9-2.4V9a5 5 0 00-5-5z"
          stroke="#F59E0B"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M11.5 21a2.5 2.5 0 005 0" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex rounded-full border border-[#DDD6FE] bg-brand-light px-3.5 py-1.5 text-xs font-semibold text-brand">
            Powerful Features
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
            All the tools you need to{" "}
            <span className="text-brand">scale your store</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#6B7280]">
            From product discovery to competitor tracking, EcomTools gives you
            everything to make data-driven decisions and grow faster.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-gray-100 bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_8px_24px_rgba(88,66,244,0.08)]"
            >
              <div
                className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl ${feature.iconBg}`}
              >
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-[#111827]">{feature.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-[#6B7280]">
                {feature.description}
              </p>
            </article>
          ))}
        </div>

        <div id="trial" className="mt-16 scroll-mt-24 text-center">
          <CTAButton size="lg" href="/sign-up" />
          <p className="mt-4 text-sm text-[#6B7280]">
            No credit card required.{" "}
            <span className="font-semibold text-[#374151]">7-day free trial.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
