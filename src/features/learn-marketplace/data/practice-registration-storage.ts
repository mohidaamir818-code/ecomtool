export const PRACTICE_BUSINESS_DETAILS_DATA_KEY =
  "learn_marketplace_practice_business_details_data";
export const PRACTICE_CONTACT_DETAILS_DATA_KEY =
  "learn_marketplace_practice_contact_details_data";
export const PRACTICE_PAYOUT_DETAILS_DATA_KEY = "learn_marketplace_practice_payout_details_data";
export const PRACTICE_PAYOUT_DONE_KEY = "learn_marketplace_practice_payout_done";

export interface PracticeBusinessDetailsData {
  legalName: string;
  registrationNumber: string;
  street1: string;
  street2: string;
  city: string;
  county: string;
  postcode: string;
  phone: string;
}

export interface PracticeContactDetailsData {
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

export interface PracticePayoutDetailsData {
  accountHolderName: string;
  bankName: string;
  sortCode: string;
  accountNumber: string;
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function savePracticeBusinessDetails(data: PracticeBusinessDetailsData) {
  sessionStorage.setItem(PRACTICE_BUSINESS_DETAILS_DATA_KEY, JSON.stringify(data));
}

export function loadPracticeBusinessDetails(): PracticeBusinessDetailsData | null {
  return readJson<PracticeBusinessDetailsData>(PRACTICE_BUSINESS_DETAILS_DATA_KEY);
}

export function savePracticeContactDetails(data: PracticeContactDetailsData) {
  sessionStorage.setItem(PRACTICE_CONTACT_DETAILS_DATA_KEY, JSON.stringify(data));
}

export function loadPracticeContactDetails(): PracticeContactDetailsData | null {
  return readJson<PracticeContactDetailsData>(PRACTICE_CONTACT_DETAILS_DATA_KEY);
}

export function savePracticePayoutDetails(data: PracticePayoutDetailsData) {
  sessionStorage.setItem(PRACTICE_PAYOUT_DETAILS_DATA_KEY, JSON.stringify(data));
}

export function loadPracticePayoutDetails(): PracticePayoutDetailsData | null {
  return readJson<PracticePayoutDetailsData>(PRACTICE_PAYOUT_DETAILS_DATA_KEY);
}

export function formatSortCodeDisplay(digits: string): string {
  const clean = digits.replace(/\D/g, "");
  if (clean.length !== 6) return digits;
  return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
}

export function formatFullName(parts: {
  firstName: string;
  middleName: string;
  surname: string;
}): string {
  return [parts.firstName, parts.middleName, parts.surname]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

export function formatAddress(parts: {
  street1: string;
  street2?: string;
  city: string;
  county: string;
  country?: string;
  postcode?: string;
}): string {
  return [
    parts.street1.trim(),
    parts.street2?.trim(),
    parts.city.trim(),
    parts.county.trim(),
    parts.postcode?.trim(),
    parts.country?.trim(),
  ]
    .filter(Boolean)
    .join(", ");
}

export function maskAccountNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return digits;
  return `••••${digits.slice(-4)}`;
}

const PRACTICE_SESSION_KEYS = [
  PRACTICE_BUSINESS_DETAILS_DATA_KEY,
  PRACTICE_CONTACT_DETAILS_DATA_KEY,
  PRACTICE_PAYOUT_DETAILS_DATA_KEY,
  PRACTICE_PAYOUT_DONE_KEY,
  "learn_marketplace_practice_business_details_done",
  "learn_marketplace_practice_contact_stakeholders_done",
  "learn_marketplace_practice_email",
  "learn_marketplace_practice_phone",
  "learn_marketplace_practice_phone_otp",
  "learn_marketplace_practice_username",
  "learn_marketplace_practice_business_type",
  "learn_marketplace_practice_registered_subtype",
  "learn_marketplace_business_details_guide_ack",
  "learn_marketplace_business_details_next_step_guide_ack",
  "learn_marketplace_contact_stakeholders_guide_ack",
  "learn_marketplace_payout_information_guide_ack",
  "learn_marketplace_business_type_guide_ack",
  "learn_marketplace_registered_subtype_guide_ack",
  "learn_marketplace_username_guide_ack",
  "learn_marketplace_phone_verify_guide_ack",
  "learn_marketplace_phone_method_guide_ack",
  "learn_marketplace_register_credentials_ack",
  "learn_marketplace_verify_email_guide_ack",
] as const;

const PRACTICE_CURSOR_PREFIXES = [
  "learn_marketplace_business_details_cursor_",
  "learn_marketplace_contact_stakeholders_cursor_",
  "learn_marketplace_payout_information_cursor_",
  "learn_marketplace_business_type_cursor_",
  "learn_marketplace_registered_subtype_cursor_",
  "learn_marketplace_username_cursor_",
  "learn_marketplace_phone_verify_cursor_",
  "learn_marketplace_phone_method_cursor_",
] as const;

/** Clear practice registration progress so the seller can start again from the beginning. */
export function resetPracticeRegistration() {
  for (const key of PRACTICE_SESSION_KEYS) {
    sessionStorage.removeItem(key);
  }

  const userId = sessionStorage.getItem("ecomtools_user_id");
  if (userId) {
    for (const prefix of PRACTICE_CURSOR_PREFIXES) {
      localStorage.removeItem(`${prefix}${userId}`);
    }
  }
}
