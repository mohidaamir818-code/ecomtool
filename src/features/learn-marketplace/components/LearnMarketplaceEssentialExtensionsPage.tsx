"use client";

import { useRouter } from "next/navigation";

const GRABLEY_CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/grabley-product-search-to/hppdgjpcbnbfapnailmeiibngpolplao";

const ALISAVE_CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/alisave-download-aliexpre/nbhfcmbdimdbbclfngkjfmgmjhnkjocl";

const extensions = [
  {
    name: "GRABLEY - Product Search Tools",
    description:
      "Search and research products across Amazon, eBay, and other marketplaces to find profitable opportunities faster.",
    buttonLabel: "Add GRABLEY",
    url: GRABLEY_CHROME_STORE_URL,
  },
  {
    name: "AliSave",
    description:
      "Download AliExpress product images and videos in one click — essential for building your listings.",
    buttonLabel: "Add AliSave",
    url: ALISAVE_CHROME_STORE_URL,
  },
] as const;

export function LearnMarketplaceEssentialExtensionsPage() {
  const router = useRouter();

  function handleDone() {
    router.push("/dashboard/learn-ebay");
  }

  return (
    <div className="flex min-h-[calc(100vh-52px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-[760px] rounded-2xl border border-gray-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3665f3]">
            Account creation complete
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#191919]">
            Add essential extensions
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#555]">
            Install these Chrome extensions before you continue. They will help you research products
            and prepare listings for your marketplace selling workflow.
          </p>
        </div>

        <div className="space-y-4">
          {extensions.map((extension) => (
            <div
              key={extension.name}
              className="rounded-xl border border-gray-100 bg-[#f7f7f7] p-5"
            >
              <p className="text-sm font-semibold text-[#191919]">{extension.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#555]">{extension.description}</p>
              <a
                href={extension.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center rounded-full bg-[#3665f3] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2f56cc]"
              >
                {extension.buttonLabel}
              </a>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end border-t border-gray-100 pt-6">
          <button
            type="button"
            onClick={handleDone}
            className="rounded-full bg-[#3665f3] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#2f56cc]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
