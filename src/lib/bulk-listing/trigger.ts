/**
 * Server-side trigger for the bulk-listing worker.
 *
 * On the Vercel Hobby plan, scheduled crons run at most once per day, which is
 * too slow to drain a freshly-queued batch. Instead we run prepare waves
 * in-process (via `after()`), and chain another wave while jobs remain.
 *
 * Important: do NOT HTTP self-call `/api/cron/bulk-listing` — that deadlocks or
 * cancels under low concurrency and leaves every job stuck in Queued.
 */

import { after } from "next/server";
import { runBulkListingWave } from "@/lib/bulk-listing/service";

const WAVE_BUDGET_MS = 45_000;

/**
 * Runs one prepare wave, then schedules another if the queue is not empty.
 * Safe to call from `after()` so work continues after the HTTP response.
 * Never throws.
 */
export async function triggerBulkListingWorker(): Promise<void> {
  try {
    const { remaining } = await runBulkListingWave(WAVE_BUDGET_MS);
    if (remaining > 0) {
      after(() => {
        void triggerBulkListingWorker();
      });
    }
  } catch (error) {
    console.error("[bulk-listing] worker wave failed:", error);
  }
}
