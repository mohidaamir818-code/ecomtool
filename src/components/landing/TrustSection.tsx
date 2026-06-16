function AmazefLogo() {
  return (
    <div className="flex items-center gap-2.5 opacity-70 grayscale">
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden>
        <rect width="36" height="36" rx="10" fill="#374151" />
        <path
          d="M10 24V12h4.5l2.5 8 2.5-8H24v12h-3v-7.5l-2.5 7.5h-2.5l-2.5-7.5V24H10z"
          fill="white"
        />
      </svg>
      <span className="text-[2rem] font-extrabold tracking-tight text-[#374151]">
        Amazef
      </span>
    </div>
  );
}

function EbayLogo() {
  return (
    <div className="opacity-70 grayscale">
      <span className="text-[2.5rem] font-bold tracking-tight">
        <span className="text-[#374151]">e</span>
        <span className="text-[#4B5563]">b</span>
        <span className="text-[#374151]">a</span>
        <span className="text-[#4B5563]">y</span>
      </span>
    </div>
  );
}

export function TrustSection() {
  return (
    <section className="border-y border-gray-100 bg-white py-14">
      <div className="mx-auto max-w-[1280px] px-6 text-center lg:px-10">
        <p className="text-sm font-medium text-[#6B7280]">
          Trusted by e-commerce sellers worldwide
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-16 sm:gap-24">
          <AmazefLogo />
          <EbayLogo />
        </div>
      </div>
    </section>
  );
}
