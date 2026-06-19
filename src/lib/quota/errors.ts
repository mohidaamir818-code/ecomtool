import "server-only";

import type { QuotaPlatform } from "@/types/quota";

export class QuotaExceededError extends Error {
  readonly code = "quota_exceeded" as const;
  readonly platform: QuotaPlatform;
  readonly used: number;
  readonly limit: number | null;
  readonly remaining: number;
  readonly resetsAt: string;

  constructor(input: {
    platform: QuotaPlatform;
    used: number;
    limit: number | null;
    remaining: number;
    resetsAt: string;
    message: string;
  }) {
    super(input.message);
    this.name = "QuotaExceededError";
    this.platform = input.platform;
    this.used = input.used;
    this.limit = input.limit;
    this.remaining = input.remaining;
    this.resetsAt = input.resetsAt;
  }
}

export function getNextUtcMidnight(from = new Date()): Date {
  const next = new Date(from);
  next.setUTCHours(24, 0, 0, 0);
  return next;
}

export function getNextUtcMidnightIso(from = new Date()): string {
  return getNextUtcMidnight(from).toISOString();
}

export function getTomorrowUtcDate(from = new Date()): string {
  const tomorrow = new Date(from);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

export function getTodayUtcDate(from = new Date()): string {
  return from.toISOString().slice(0, 10);
}
