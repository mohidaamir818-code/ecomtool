import { LISTING_WIZARD_STEPS } from "@/types/listing-generator";

export const CONFIRM_STEP = 9;
export const VOLUME_DISCOUNTS_STEP = 7;

export const AMAZEF_SELECTABLE_STEPS = [
  { id: 0, label: LISTING_WIZARD_STEPS[0] },
  { id: 1, label: LISTING_WIZARD_STEPS[1] },
  { id: 2, label: LISTING_WIZARD_STEPS[2] },
  { id: 3, label: LISTING_WIZARD_STEPS[3] },
  { id: 4, label: LISTING_WIZARD_STEPS[4] },
  { id: 5, label: LISTING_WIZARD_STEPS[5] },
  { id: 6, label: LISTING_WIZARD_STEPS[6] },
  { id: 8, label: LISTING_WIZARD_STEPS[8] },
  { id: 9, label: LISTING_WIZARD_STEPS[9] },
] as const;

export function amazefAutoListingStorageKey(userId: string) {
  return `amazef-auto-listing-visible-steps-${userId}`;
}

export function amazefShippingStorageKey(userId: string) {
  return `amazef-default-shipping-days-${userId}`;
}

export function isAmazefSkippedStep(step: number): boolean {
  return step === VOLUME_DISCOUNTS_STEP;
}

export function getNextWizardStepIndex(step: number): number {
  let next = step + 1;
  if (next === VOLUME_DISCOUNTS_STEP) next += 1;
  return Math.min(next, CONFIRM_STEP);
}

export function normalizeVisibleSteps(steps: number[]): number[] {
  const filtered = steps.filter((step) => !isAmazefSkippedStep(step));
  if (!filtered.includes(CONFIRM_STEP)) {
    filtered.push(CONFIRM_STEP);
  }
  return [...new Set(filtered)].sort((a, b) => a - b);
}

export function visibleStepsToSet(steps: number[]): Set<number> {
  return new Set(normalizeVisibleSteps(steps));
}

export function getPrevVisibleStep(current: number, visible: Set<number>): number {
  let best = -1;
  for (const step of visible) {
    if (step < current && !isAmazefSkippedStep(step) && step > best) {
      best = step;
    }
  }
  if (best >= 0) return best;
  return Math.max(0, current - 1);
}

export function getNextVisibleStep(current: number, visible: Set<number>): number | null {
  for (let step = getNextWizardStepIndex(current); step <= CONFIRM_STEP; step = getNextWizardStepIndex(step)) {
    if (visible.has(step)) return step;
  }
  return null;
}

export function loadVisibleStepsFromStorage(userId: string): number[] | null {
  try {
    const raw = localStorage.getItem(amazefAutoListingStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const steps = parsed.map((value) => Number(value)).filter((value) => Number.isFinite(value));
    return normalizeVisibleSteps(steps);
  } catch {
    return null;
  }
}

export function saveVisibleStepsToStorage(userId: string, steps: number[]) {
  localStorage.setItem(amazefAutoListingStorageKey(userId), JSON.stringify(normalizeVisibleSteps(steps)));
}
