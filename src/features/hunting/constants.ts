export const HUNT_LOOKBACK_OPTIONS = [7, 14, 30, 90] as const;

export type HuntLookbackDays = (typeof HUNT_LOOKBACK_OPTIONS)[number];

export const DEFAULT_HUNT_LOOKBACK_DAYS: HuntLookbackDays = 7;
