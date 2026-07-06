"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { PRACTICE_BUSINESS_DETAILS_DONE_KEY } from "@/features/learn-marketplace/components/LearnMarketplaceContactStakeholdersGuide";
import { PRACTICE_REGISTERED_SUBTYPE_KEY } from "@/features/learn-marketplace/components/LearnMarketplaceBusinessTypeGuide";
import { PRACTICE_CONTACT_STAKEHOLDERS_DONE_KEY } from "@/features/learn-marketplace/components/LearnMarketplacePayoutInformationGuide";
import {
  formatAddress,
  formatFullName,
  formatSortCodeDisplay,
  loadPracticeBusinessDetails,
  loadPracticeContactDetails,
  loadPracticePayoutDetails,
  maskAccountNumber,
  PRACTICE_PAYOUT_DONE_KEY,
  type PracticeBusinessDetailsData,
  type PracticeContactDetailsData,
  type PracticePayoutDetailsData,
} from "@/features/learn-marketplace/data/practice-registration-storage";
import { PRACTICE_USERNAME_KEY } from "@/features/learn-marketplace/components/LearnMarketplaceUsernameGuide";

const signupSteps = [
  { label: "Business details", status: "done" as const },
  { label: "Contact and stakeholders", status: "done" as const },
  { label: "Payout information", status: "done" as const },
  { label: "Review and submit", status: "current" as const },
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

function EditIconButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#767676] transition hover:bg-gray-100 hover:text-[#191919]"
      aria-label={label}
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path
          d="M12 20h9M16.5 3.5a2.12 2.12 0 113 3L7 19l-4 1 1-4 12.5-12.5z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;

  return (
    <div className="grid gap-1 border-b border-gray-100 py-3 last:border-b-0 sm:grid-cols-[200px_1fr] sm:gap-6">
      <dt className="text-sm text-[#767676]">{label}</dt>
      <dd className="text-sm font-medium text-[#191919]">{value}</dd>
    </div>
  );
}

function ReviewSectionCard({
  title,
  editHref,
  editLabel,
  children,
}: {
  title: string;
  editHref: string;
  editLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-bold text-[#191919]">{title}</h2>
        <EditIconButton href={editHref} label={editLabel} />
      </div>
      <dl className="mt-4">{children}</dl>
    </section>
  );
}

export function LearnMarketplaceReviewSubmitPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [business, setBusiness] = useState<PracticeBusinessDetailsData | null>(null);
  const [contact, setContact] = useState<PracticeContactDetailsData | null>(null);
  const [payout, setPayout] = useState<PracticePayoutDetailsData | null>(null);

  useEffect(() => {
    const username = sessionStorage.getItem(PRACTICE_USERNAME_KEY);
    const subtype = sessionStorage.getItem(PRACTICE_REGISTERED_SUBTYPE_KEY);
    const businessDetailsDone =
      sessionStorage.getItem(PRACTICE_BUSINESS_DETAILS_DONE_KEY) === "true";
    const contactDone =
      sessionStorage.getItem(PRACTICE_CONTACT_STAKEHOLDERS_DONE_KEY) === "true";
    const payoutDone = sessionStorage.getItem(PRACTICE_PAYOUT_DONE_KEY) === "true";

    if (
      !username ||
      subtype !== "company" ||
      !businessDetailsDone ||
      !contactDone ||
      !payoutDone
    ) {
      router.replace("/dashboard/learn-ebay/register/payout-information");
      return;
    }

    setBusiness(loadPracticeBusinessDetails());
    setContact(loadPracticeContactDetails());
    setPayout(loadPracticePayoutDetails());
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#f7f7f7]">
        <svg className="h-8 w-8 animate-spin text-[#3665f3]" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const contactName = contact ? formatFullName(contact) : "";
  const businessAddress = business
    ? formatAddress({
        street1: business.street1,
        street2: business.street2,
        city: business.city,
        county: business.county,
        postcode: business.postcode,
        country: "United Kingdom",
      })
    : "";
  const contactAddress = contact
    ? formatAddress({
        street1: contact.street1,
        street2: contact.street2,
        city: contact.city,
        county: contact.county,
        country: contact.residenceCountry,
      })
    : "";

  return (
    <div className="flex min-h-full flex-col bg-[#f7f7f7] text-[#191919]">
      <header className="border-b border-gray-200 bg-white">
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

        <div className="min-w-0 flex-1 pb-24">
          <h1 className="text-[2rem] font-bold tracking-tight">Review and submit</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#555]">
            Check all the information you entered is correct before submitting your seller registration.
          </p>

          <div className="mt-8 space-y-6">
            <ReviewSectionCard
              title="Business details"
              editHref="/dashboard/learn-ebay/register/business-details"
              editLabel="Edit business details"
            >
              <ReviewRow label="Legal business name" value={business?.legalName ?? ""} />
              <ReviewRow
                label="Company registration number"
                value={business?.registrationNumber ?? ""}
              />
              <ReviewRow label="Business address" value={businessAddress} />
              <ReviewRow label="Phone number" value={business?.phone ?? ""} />
            </ReviewSectionCard>

            <ReviewSectionCard
              title="Contact and stakeholders"
              editHref="/dashboard/learn-ebay/register/contact-stakeholders"
              editLabel="Edit contact details"
            >
              <ReviewRow label="Primary contact" value={contactName} />
              <ReviewRow label="Date of birth" value={contact?.dateOfBirth ?? ""} />
              <ReviewRow label="Nationality" value={contact?.nationality ?? ""} />
              <ReviewRow label="Company address" value={contactAddress} />
            </ReviewSectionCard>

            <ReviewSectionCard
              title="Payout information"
              editHref="/dashboard/learn-ebay/register/payout-information"
              editLabel="Edit payout information"
            >
              <ReviewRow label="Name on account" value={payout?.accountHolderName ?? ""} />
              <ReviewRow label="Bank or building society name" value={payout?.bankName ?? ""} />
              <ReviewRow
                label="Sort code"
                value={payout ? formatSortCodeDisplay(payout.sortCode) : ""}
              />
              <ReviewRow
                label="Account number"
                value={payout ? maskAccountNumber(payout.accountNumber) : ""}
              />
            </ReviewSectionCard>
          </div>

          <div className="mt-10 flex justify-end">
            <button
              type="button"
              onClick={() => router.push("/dashboard/learn-ebay/register/complete")}
              className="rounded-full bg-[#3665f3] px-10 py-3 text-sm font-semibold text-white transition hover:bg-[#2f56cc]"
            >
              Submit
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
