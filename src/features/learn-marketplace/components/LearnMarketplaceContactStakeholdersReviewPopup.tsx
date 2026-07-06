"use client";

export interface ContactStakeholdersDetails {
  firstName: string;
  middleName: string;
  surname: string;
  dateOfBirth: string;
  nationality: string;
  residenceCountry: string;
  street1: string;
  street2: string;
  city: string;
  county: string;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;

  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-36 shrink-0 text-xs font-semibold uppercase tracking-wide text-[#767676]">
        {label}
      </dt>
      <dd className="text-sm font-medium text-[#191919]">{value}</dd>
    </div>
  );
}

export function LearnMarketplaceContactStakeholdersReviewPopup({
  visible,
  details,
  onEdit,
  onContinue,
}: {
  visible: boolean;
  details: ContactStakeholdersDetails;
  onEdit: () => void;
  onContinue: () => void;
}) {
  if (!visible) return null;

  const fullName = [details.firstName, details.middleName, details.surname]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");

  const addressLines = [
    details.street1.trim(),
    details.street2.trim(),
    details.city.trim(),
    details.county.trim(),
    details.residenceCountry.trim(),
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-details-review-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl"
      >
        <div className="border-b border-gray-100 px-8 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3665f3]">
            Review your details
          </p>
          <h2
            id="contact-details-review-title"
            className="mt-3 text-2xl font-bold tracking-tight text-[#191919]"
          >
            Your personal details
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#555]">
            Check everything below matches your ID and company records before continuing.
          </p>
        </div>

        <div className="space-y-6 px-8 py-6">
          <div className="rounded-xl border border-gray-100 bg-[#f7f7f7] p-4">
            <p className="text-sm font-semibold text-[#191919]">Legal name</p>
            <dl className="mt-3 space-y-3">
              <DetailRow label="Full name" value={fullName} />
            </dl>
          </div>

          <div className="rounded-xl border border-gray-100 bg-[#f7f7f7] p-4">
            <p className="text-sm font-semibold text-[#191919]">Personal information</p>
            <dl className="mt-3 space-y-3">
              <DetailRow label="Date of birth" value={details.dateOfBirth.trim()} />
              <DetailRow label="Nationality" value={details.nationality.trim()} />
            </dl>
          </div>

          <div className="rounded-xl border border-[#3665f3]/20 bg-[#f0f6ff] p-4">
            <p className="text-sm font-semibold text-[#191919]">Company address</p>
            <dl className="mt-3 space-y-3">
              <DetailRow label="Country" value={details.residenceCountry.trim()} />
              <DetailRow label="Address" value={addressLines.join(", ")} />
            </dl>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 px-8 py-6 sm:flex-row">
          <button
            type="button"
            onClick={onEdit}
            className="w-full rounded-full border border-gray-300 px-6 py-3 text-sm font-semibold text-[#555] transition hover:bg-gray-50 sm:w-auto"
          >
            Edit details
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-full bg-[#3665f3] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2f56cc] sm:ml-auto sm:w-auto"
          >
            Continue to next page
          </button>
        </div>
      </div>
    </div>
  );
}
