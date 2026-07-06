"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LearnMarketplaceAnimatedCursor } from "@/features/learn-marketplace/components/LearnMarketplaceAnimatedCursor";
import {
  CONTACT_STAKEHOLDERS_CURSOR_KEY_PREFIX,
  CONTACT_STAKEHOLDERS_GUIDE_KEY,
  LearnMarketplaceContactStakeholdersGuide,
  PRACTICE_BUSINESS_DETAILS_DONE_KEY,
} from "@/features/learn-marketplace/components/LearnMarketplaceContactStakeholdersGuide";
import { PRACTICE_CONTACT_STAKEHOLDERS_DONE_KEY } from "@/features/learn-marketplace/components/LearnMarketplacePayoutInformationGuide";
import { LearnMarketplaceContactStakeholdersReviewPopup } from "@/features/learn-marketplace/components/LearnMarketplaceContactStakeholdersReviewPopup";
import { PRACTICE_REGISTERED_SUBTYPE_KEY } from "@/features/learn-marketplace/components/LearnMarketplaceBusinessTypeGuide";
import { MARKETPLACE_PHONE_COUNTRIES } from "@/features/learn-marketplace/data/marketplace-phone-countries";
import { PRACTICE_USERNAME_KEY } from "@/features/learn-marketplace/components/LearnMarketplaceUsernameGuide";

const signupSteps = [
  { label: "Business details", status: "done" as const },
  { label: "Contact and stakeholders", status: "current" as const },
  { label: "Payout information", status: "upcoming" as const },
  { label: "Review and submit", status: "upcoming" as const },
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
  return `${CONTACT_STAKEHOLDERS_CURSOR_KEY_PREFIX}${userId}`;
}

export function LearnMarketplaceContactStakeholdersPage() {
  const router = useRouter();
  const firstNameRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [showIntroPopup, setShowIntroPopup] = useState(false);
  const [showReviewPopup, setShowReviewPopup] = useState(false);
  const [showCursor, setShowCursor] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [surname, setSurname] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationality, setNationality] = useState("");
  const [residenceCountry, setResidenceCountry] = useState("United Kingdom");
  const [street1, setStreet1] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");

  useEffect(() => {
    const username = sessionStorage.getItem(PRACTICE_USERNAME_KEY);
    const subtype = sessionStorage.getItem(PRACTICE_REGISTERED_SUBTYPE_KEY);
    const businessDetailsDone =
      sessionStorage.getItem(PRACTICE_BUSINESS_DETAILS_DONE_KEY) === "true";

    if (!username || subtype !== "company" || !businessDetailsDone) {
      router.replace("/dashboard/learn-ebay/register/business-details");
      return;
    }

    setShowIntroPopup(sessionStorage.getItem(CONTACT_STAKEHOLDERS_GUIDE_KEY) !== "true");
    setReady(true);
  }, [router]);

  const startCursorGuide = useCallback(() => {
    setShowCursor(true);
    firstNameRef.current?.focus();
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
    firstName.trim().length >= 2 &&
    surname.trim().length >= 2 &&
    dateOfBirth.trim().length >= 6 &&
    nationality.length > 0 &&
    residenceCountry.length > 0 &&
    street1.trim().length >= 3 &&
    city.trim().length >= 2 &&
    county.length > 0;

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
      <LearnMarketplaceContactStakeholdersGuide
        visible={showIntroPopup}
        onDismiss={() => setShowIntroPopup(false)}
      />

      <LearnMarketplaceContactStakeholdersReviewPopup
        visible={showReviewPopup}
        details={{
          firstName,
          middleName,
          surname,
          dateOfBirth,
          nationality,
          residenceCountry,
          street1,
          street2,
          city,
          county,
        }}
        onEdit={() => setShowReviewPopup(false)}
        onContinue={() => {
          sessionStorage.setItem(PRACTICE_CONTACT_STAKEHOLDERS_DONE_KEY, "true");
          completeCursorGuide();
          router.push("/dashboard/learn-ebay/register/payout-information");
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
              <li key={step.label} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                    step.status === "done"
                      ? "border-[#3665f3] bg-[#3665f3] text-white"
                      : step.status === "current"
                        ? "border-[#3665f3] text-[#3665f3]"
                        : "border-gray-300 text-[#767676]"
                  }`}
                >
                  {step.status === "done" ? "✓" : index + 1}
                </span>
                <span
                  className={
                    step.status === "current"
                      ? "font-semibold text-[#191919]"
                      : step.status === "done"
                        ? "text-[#191919]"
                        : "text-[#767676]"
                  }
                >
                  {step.label}
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
              👤
            </span>
            <h1 className="text-[2rem] font-bold tracking-tight">Contact and stakeholders</h1>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#555]">
            For regulatory purposes, we require at least one primary contact and one director, as well
            as any other stakeholders listed on your company registration.
          </p>

          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Primary contact</h2>
            <p className="mt-1 text-sm text-[#555]">
              This information must exactly match the person&apos;s business licence or
              government-issued ID.
            </p>

            <p className="mt-4 rounded-xl border border-[#3665f3]/30 bg-[#f0f6ff] px-4 py-3 text-sm leading-relaxed text-[#191919]">
              <strong className="font-bold">Always give your own country details.</strong> Select your
              nationality country and enter your name exactly as on your passport or ID.
            </p>

            <section className="mt-8">
              <h3 className="text-base font-bold">Legal name</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="relative z-[70]">
                  <label htmlFor="contact-first-name" className="text-xs text-[#767676]">
                    First name
                  </label>
                  <input
                    ref={firstNameRef}
                    id="contact-first-name"
                    type="text"
                    value={firstName}
                    onChange={(event) => {
                      setFirstName(event.target.value);
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
                  <FieldInstruction>Exactly as written on your passport or ID.</FieldInstruction>
                </div>
                <div>
                  <label htmlFor="contact-middle-name" className="text-xs text-[#767676]">
                    Middle name
                  </label>
                  <input
                    id="contact-middle-name"
                    type="text"
                    value={middleName}
                    onChange={(event) => setMiddleName(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#767676] bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
                  />
                  <FieldInstruction>If listed on your government-issued ID.</FieldInstruction>
                </div>
                <div className="sm:col-span-2 sm:max-w-md">
                  <label htmlFor="contact-surname" className="text-xs text-[#767676]">
                    Surname
                  </label>
                  <input
                    id="contact-surname"
                    type="text"
                    value={surname}
                    onChange={(event) => setSurname(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#767676] bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
                  />
                  <FieldInstruction>Family name exactly as on your passport or ID.</FieldInstruction>
                </div>
              </div>
            </section>

            <section className="mt-8">
              <h3 className="text-base font-bold">Personal information</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="contact-dob" className="text-xs text-[#767676]">
                    Date of birth
                  </label>
                  <input
                    id="contact-dob"
                    type="text"
                    placeholder="DD / MM / YYYY"
                    value={dateOfBirth}
                    onChange={(event) => setDateOfBirth(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#767676] bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
                  />
                  <FieldInstruction>
                    <strong className="text-[#191919]">Give the date exactly as on your ID</strong> —
                    same day, month and year as printed on your passport or government-issued ID.
                  </FieldInstruction>
                </div>
                <div>
                  <label htmlFor="contact-nationality" className="text-xs text-[#767676]">
                    Nationality
                  </label>
                  <select
                    id="contact-nationality"
                    value={nationality}
                    onChange={(event) => setNationality(event.target.value)}
                    className="mt-1 w-full appearance-none rounded-xl border border-[#767676] bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
                  >
                    <option value="" disabled>
                      Select nationality
                    </option>
                    {MARKETPLACE_PHONE_COUNTRIES.map((country) => (
                      <option key={country.iso} value={country.name}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                  <FieldInstruction>
                    Choose <strong className="text-[#191919]">your own nationality country</strong>,
                    not a suggested default.
                  </FieldInstruction>
                </div>
              </div>
            </section>

            <section className="mt-8">
              <h3 className="text-base font-bold">Legal residence</h3>
              <FieldInstruction>
                <strong className="text-[#191919]">Write only the address of the company</strong> —
                use your company&apos;s registered business address, not a personal home address.
              </FieldInstruction>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 sm:max-w-md">
                  <label htmlFor="residence-country" className="text-xs text-[#767676]">
                    Country or region
                  </label>
                  <select
                    id="residence-country"
                    value={residenceCountry}
                    onChange={(event) => setResidenceCountry(event.target.value)}
                    className="mt-1 w-full appearance-none rounded-xl border border-[#767676] bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
                  >
                    {MARKETPLACE_PHONE_COUNTRIES.map((country) => (
                      <option key={country.iso} value={country.name}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                  <FieldInstruction>
                    Country where your <strong className="text-[#191919]">company is registered</strong>.
                  </FieldInstruction>
                </div>
                <div>
                  <label htmlFor="contact-street-1" className="text-xs text-[#767676]">
                    Street address 1
                  </label>
                  <input
                    id="contact-street-1"
                    type="text"
                    value={street1}
                    onChange={(event) => setStreet1(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#767676] bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
                  />
                  <FieldInstruction>
                    <strong className="text-[#191919]">Company address only</strong> — street line 1 of
                    your registered company address.
                  </FieldInstruction>
                </div>
                <div>
                  <label htmlFor="contact-street-2" className="text-xs text-[#767676]">
                    Street address 2 (optional)
                  </label>
                  <input
                    id="contact-street-2"
                    type="text"
                    value={street2}
                    onChange={(event) => setStreet2(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#767676] bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
                  />
                  <FieldInstruction>Optional second line of the company address.</FieldInstruction>
                </div>
                <div>
                  <label htmlFor="contact-city" className="text-xs text-[#767676]">
                    City
                  </label>
                  <input
                    id="contact-city"
                    type="text"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#767676] bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2"
                  />
                  <FieldInstruction>City from your company&apos;s registered address.</FieldInstruction>
                </div>
                <div>
                  <label htmlFor="contact-county" className="text-xs text-[#767676]">
                    County
                  </label>
                  <select
                    id="contact-county"
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
                  <FieldInstruction>County for the company&apos;s registered address.</FieldInstruction>
                </div>
              </div>
            </section>
          </div>

          <div className="relative z-[95] mt-10 flex justify-end pb-24">
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => {
                if (!canContinue) return;
                setShowReviewPopup(true);
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

      <LearnMarketplaceAnimatedCursor targetRef={firstNameRef} visible={showCursor} />

      {showCursor ? (
        <div className="pointer-events-none fixed inset-0 z-[60] bg-black/20" aria-hidden />
      ) : null}

      <button
        type="button"
        onClick={() => {
          sessionStorage.removeItem(CONTACT_STAKEHOLDERS_GUIDE_KEY);
          setShowIntroPopup(true);
        }}
        className="fixed bottom-20 right-6 z-[90] inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-[#555] shadow-lg transition hover:bg-gray-50"
      >
        Show contact guide
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
