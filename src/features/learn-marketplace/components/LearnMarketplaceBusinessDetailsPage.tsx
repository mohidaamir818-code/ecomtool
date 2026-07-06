"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LearnMarketplaceAnimatedCursor } from "@/features/learn-marketplace/components/LearnMarketplaceAnimatedCursor";
import {
  BUSINESS_DETAILS_CURSOR_KEY_PREFIX,
  BUSINESS_DETAILS_GUIDE_KEY,
  LearnMarketplaceBusinessDetailsGuide,
} from "@/features/learn-marketplace/components/LearnMarketplaceBusinessDetailsGuide";
import { LearnMarketplaceBusinessDetailsNextStepGuide } from "@/features/learn-marketplace/components/LearnMarketplaceBusinessDetailsNextStepGuide";
import { PRACTICE_BUSINESS_DETAILS_DONE_KEY } from "@/features/learn-marketplace/components/LearnMarketplaceContactStakeholdersGuide";
import { savePracticeBusinessDetails } from "@/features/learn-marketplace/data/practice-registration-storage";
import { PRACTICE_REGISTERED_SUBTYPE_KEY } from "@/features/learn-marketplace/components/LearnMarketplaceBusinessTypeGuide";
import { PRACTICE_USERNAME_KEY } from "@/features/learn-marketplace/components/LearnMarketplaceUsernameGuide";

const PRACTICE_PHONE_KEY = "learn_marketplace_practice_phone";

const signupSteps = [
  "Business details",
  "Contact and stakeholders",
  "Payout information",
  "Review and submit",
];

const ukCounties = [
  "Bedfordshire",
  "Berkshire",
  "Bristol",
  "Buckinghamshire",
  "Cambridgeshire",
  "Cheshire",
  "City of London",
  "Cornwall",
  "Cumbria",
  "Derbyshire",
  "Devon",
  "Dorset",
  "Durham",
  "East Sussex",
  "Essex",
  "Gloucestershire",
  "Greater London",
  "Greater Manchester",
  "Hampshire",
  "Hertfordshire",
  "Kent",
  "Lancashire",
  "Leicestershire",
  "Lincolnshire",
  "Merseyside",
  "Norfolk",
  "North Yorkshire",
  "Northamptonshire",
  "Nottinghamshire",
  "Oxfordshire",
  "Somerset",
  "South Yorkshire",
  "Staffordshire",
  "Suffolk",
  "Surrey",
  "Tyne and Wear",
  "Warwickshire",
  "West Midlands",
  "West Sussex",
  "West Yorkshire",
  "Wiltshire",
];

function MarketplaceLogo() {
  return (
    <Link href="/dashboard/learn-ebay" className="text-2xl font-bold tracking-tight">
      <span className="text-[#e53238]">m</span>
      <span className="text-[#0064d2]">a</span>
      <span className="text-[#f5af02]">r</span>
      <span className="text-[#86b817]">k</span>
      <span className="text-[#e53238]">e</span>
      <span className="text-[#0064d2]">t</span>
    </Link>
  );
}

function FieldInstruction({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1.5 rounded-lg border border-[#3665f3]/20 bg-[#f0f6ff] px-3 py-2 text-xs leading-relaxed text-[#555]">
      {children}
    </p>
  );
}

function cursorGuideStorageKey(userId: string) {
  return `${BUSINESS_DETAILS_CURSOR_KEY_PREFIX}${userId}`;
}

export function LearnMarketplaceBusinessDetailsPage() {
  const router = useRouter();
  const legalNameRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [showIntroPopup, setShowIntroPopup] = useState(false);
  const [showNextStepPopup, setShowNextStepPopup] = useState(false);
  const [showCursor, setShowCursor] = useState(false);

  const [legalName, setLegalName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [street1, setStreet1] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [postcode, setPostcode] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const username = sessionStorage.getItem(PRACTICE_USERNAME_KEY);
    const subtype = sessionStorage.getItem(PRACTICE_REGISTERED_SUBTYPE_KEY);
    if (!username || subtype !== "company") {
      router.replace("/dashboard/learn-ebay/register/business-type");
      return;
    }

    const storedPhone = sessionStorage.getItem(PRACTICE_PHONE_KEY) ?? "";
    const phoneDigits = storedPhone.replace(/^\+44\s*/, "").trim();
    if (phoneDigits) setPhone(phoneDigits);

    setShowIntroPopup(sessionStorage.getItem(BUSINESS_DETAILS_GUIDE_KEY) !== "true");
    setReady(true);
  }, [router]);

  const startCursorGuide = useCallback(() => {
    setShowCursor(true);
    legalNameRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!ready || showIntroPopup) return;

    const userId = sessionStorage.getItem("ecomtools_user_id");
    const cursorSeen =
      userId != null && localStorage.getItem(cursorGuideStorageKey(userId)) === "true";
    if (!cursorSeen) {
      startCursorGuide();
    }
  }, [ready, showIntroPopup, startCursorGuide]);

  function completeCursorGuide() {
    const userId = sessionStorage.getItem("ecomtools_user_id");
    if (userId) {
      localStorage.setItem(cursorGuideStorageKey(userId), "true");
    }
    setShowCursor(false);
  }

  const canContinue =
    legalName.trim().length >= 2 &&
    registrationNumber.trim().length >= 2 &&
    street1.trim().length >= 3 &&
    city.trim().length >= 2 &&
    county.length > 0 &&
    postcode.trim().length >= 4 &&
    phone.replace(/\D/g, "").length >= 6;

  if (!ready) {
    return (
      <div className="flex min-h-full items-center justify-center bg-white">
        <svg className="h-8 w-8 animate-spin text-[#3665f3]" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-white text-[#191919]">
      <LearnMarketplaceBusinessDetailsGuide
        visible={showIntroPopup}
        onDismiss={() => setShowIntroPopup(false)}
      />
      <LearnMarketplaceBusinessDetailsNextStepGuide
        visible={showNextStepPopup}
        onDismiss={() => {
          setShowNextStepPopup(false);
          savePracticeBusinessDetails({
            legalName,
            registrationNumber,
            street1,
            street2,
            city,
            county,
            postcode,
            phone,
          });
          sessionStorage.setItem(PRACTICE_BUSINESS_DETAILS_DONE_KEY, "true");
          router.push("/dashboard/learn-ebay/register/contact-stakeholders");
        }}
      />

      <style jsx global>{`
        @keyframes learn-cursor-wiggle {
          0%,
          100% {
            transform: translate(0, 0) rotate(-8deg);
          }
          25% {
            transform: translate(6px, 4px) rotate(-2deg);
          }
          50% {
            transform: translate(2px, 8px) rotate(-12deg);
          }
          75% {
            transform: translate(8px, 2px) rotate(-4deg);
          }
        }
      `}</style>

      <header className="border-b border-gray-200">
        <div className="mx-auto max-w-[1200px] px-6 py-4">
          <MarketplaceLogo />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1200px] flex-1 gap-10 px-6 py-10">
        <aside className="hidden w-[240px] shrink-0 lg:block">
          <p className="text-lg font-bold">New seller sign-up</p>
          <ol className="mt-8 space-y-5">
            {signupSteps.map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                    index === 0
                      ? "border-[#3665f3] text-[#3665f3]"
                      : "border-gray-300 text-[#767676]"
                  }`}
                >
                  {index + 1}
                </span>
                <span className={index === 0 ? "font-semibold text-[#191919]" : "text-[#767676]"}>
                  {step}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-10 border-t border-gray-200 pt-6 text-sm text-[#555]">
            <p>
              <span className="font-semibold text-[#191919]">Business type:</span> Company
            </p>
            <p className="mt-2">
              <span className="font-semibold text-[#191919]">Business location:</span> United Kingdom
            </p>
            <button type="button" className="mt-3 text-[#3665f3] hover:underline">
              Edit
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>
              💼
            </span>
            <h1 className="text-[2rem] font-bold tracking-tight">Business details</h1>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#555]">
            Your business name and physical address may be shared on each listing and with buyers after
            purchase to comply with applicable regulations.
          </p>

          <section className="mt-10">
            <h2 className="text-lg font-bold">Business profile</h2>
            <p className="mt-1 text-sm text-[#555]">
              This information must exactly match your business licence.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="relative z-[70] sm:col-span-1">
                <label htmlFor="legal-business-name" className="text-xs text-[#767676]">
                  Legal business name
                </label>
                <input
                  ref={legalNameRef}
                  id="legal-business-name"
                  type="text"
                  value={legalName}
                  onChange={(event) => {
                    setLegalName(event.target.value);
                    if (showCursor && event.target.value.trim()) {
                      completeCursorGuide();
                    }
                  }}
                  className={`mt-1 w-full rounded-xl border bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2 ${
                    showCursor
                      ? "border-[#3665f3] ring-4 ring-[#3665f3]/20"
                      : "border-[#767676]"
                  }`}
                />
                <FieldInstruction>
                  Write your registered company name exactly as on Companies House or your business
                  licence.
                </FieldInstruction>
              </div>

              <div>
                <label htmlFor="dba-name" className="text-xs text-[#767676]">
                  Doing Business As (if applicable)
                </label>
                <input
                  id="dba-name"
                  type="text"
                  value=""
                  readOnly
                  disabled
                  tabIndex={-1}
                  className="mt-1 w-full cursor-not-allowed rounded-xl border border-gray-200 bg-[#f0f0f0] px-4 py-3.5 text-sm text-[#767676] outline-none"
                />
                <FieldInstruction>
                  Do not fill this field. Leave &quot;Doing Business As&quot; blank and only enter your
                  legal business name.
                </FieldInstruction>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="company-number" className="text-xs text-[#767676]">
                  Company registration number
                </label>
                <input
                  id="company-number"
                  type="text"
                  value={registrationNumber}
                  onChange={(event) => setRegistrationNumber(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#767676] bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
                />
                <FieldInstruction>
                  Enter your company registration number (e.g. Companies House number for UK Ltd).
                </FieldInstruction>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold">Business address</h2>
            <p className="mt-1 text-sm text-[#555]">
              This information must exactly match your business licence.
            </p>
            <p className="mt-3 text-sm text-[#555]">
              Country or region: <span className="font-semibold text-[#191919]">United Kingdom</span>{" "}
              <button type="button" className="text-[#3665f3] hover:underline">
                Change
              </button>
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="street-1" className="text-xs text-[#767676]">
                  Street address 1
                </label>
                <input
                  id="street-1"
                  type="text"
                  value={street1}
                  onChange={(event) => setStreet1(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#767676] bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
                />
                <FieldInstruction>Registered business street address line 1.</FieldInstruction>
              </div>
              <div>
                <label htmlFor="street-2" className="text-xs text-[#767676]">
                  Street address 2 (optional)
                </label>
                <input
                  id="street-2"
                  type="text"
                  value={street2}
                  onChange={(event) => setStreet2(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#767676] bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
                />
              </div>
              <div>
                <label htmlFor="city" className="text-xs text-[#767676]">
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#767676] bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
                />
                <FieldInstruction>Town or city from your registered business address.</FieldInstruction>
              </div>
              <div>
                <label htmlFor="county" className="text-xs text-[#767676]">
                  County
                </label>
                <select
                  id="county"
                  value={county}
                  onChange={(event) => setCounty(event.target.value)}
                  className="mt-1 w-full appearance-none rounded-xl border border-[#767676] bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
                >
                  <option value="" disabled>
                    Select county
                  </option>
                  {ukCounties.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <FieldInstruction>Select the county for your registered business address.</FieldInstruction>
              </div>
              <div className="sm:col-span-2 sm:max-w-xs">
                <label htmlFor="postcode" className="text-xs text-[#767676]">
                  Postcode
                </label>
                <input
                  id="postcode"
                  type="text"
                  value={postcode}
                  onChange={(event) => setPostcode(event.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-xl border border-[#767676] bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
                />
                <FieldInstruction>UK postcode exactly as on your business licence.</FieldInstruction>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold">Contact information</h2>
            <p className="mt-1 text-sm text-[#555]">
              We&apos;ll verify this number with your choice of a text or call.
            </p>

            <div className="mt-5 max-w-md">
              <label htmlFor="business-phone" className="text-xs text-[#767676]">
                Phone number
              </label>
              <div className="mt-1 flex overflow-hidden rounded-xl border border-[#767676] bg-[#f7f7f7]">
                <div className="flex shrink-0 items-center gap-2 border-r border-[#767676] px-3 text-sm">
                  <span aria-hidden>🇬🇧</span>
                  <span className="font-medium">+44</span>
                </div>
                <input
                  id="business-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/[^\d\s()-]/g, ""))}
                  className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-sm outline-none"
                />
              </div>
              <FieldInstruction>
                Use the same mobile number you entered during sign-up. We may send a verification code
                by text or call.
              </FieldInstruction>
            </div>
          </section>

          <div className="relative z-[95] mt-12 flex justify-end pb-24">
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => {
                if (!canContinue) return;
                completeCursorGuide();
                setShowNextStepPopup(true);
              }}
              className={`rounded-full px-10 py-3 text-sm font-semibold text-white transition ${
                canContinue
                  ? "bg-[#3665f3] hover:bg-[#2f56cc]"
                  : "cursor-not-allowed bg-[#767676]"
              }`}
            >
              Continue
            </button>
          </div>
        </div>
      </main>

      <LearnMarketplaceAnimatedCursor targetRef={legalNameRef} visible={showCursor} />

      {showCursor ? (
        <div className="pointer-events-none fixed inset-0 z-[60] bg-black/20" aria-hidden />
      ) : null}

      <button
        type="button"
        onClick={() => {
          sessionStorage.removeItem(BUSINESS_DETAILS_GUIDE_KEY);
          setShowIntroPopup(true);
        }}
        className="fixed bottom-20 right-6 z-[90] inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-[#555] shadow-lg transition hover:bg-gray-50"
      >
        Show details guide
      </button>

      <button
        type="button"
        onClick={startCursorGuide}
        className="fixed bottom-6 right-6 z-[90] inline-flex items-center gap-2 rounded-full border border-[#3665f3] bg-white px-4 py-2.5 text-sm font-semibold text-[#3665f3] shadow-lg transition hover:bg-[#3665f3] hover:text-white"
        aria-label="Show cursor guide again"
      >
        <span aria-hidden>🖱️</span>
        Cursor guide
      </button>
    </div>
  );
}
