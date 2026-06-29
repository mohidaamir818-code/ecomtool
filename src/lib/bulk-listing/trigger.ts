/**
 * Server-side trigger for the bulk-listing worker.
 *
 * On the Vercel Hobby plan, scheduled crons run at most once per day, which is
 * too slow to drain a freshly-queued batch. Instead we kick the worker route
 * directly (fire-and-forget) when a batch is created, and the worker re-triggers
 * itself in waves until the queue is empty. This keeps listings progressing
 * server-side even after the seller closes the tab — no frequent cron needed.
 */

function resolveWorkerBaseUrl(): string | null {
  const appUrl = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (appUrl) return appUrl;

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;

  return null;
}

/**
 * Fires a request at the bulk-listing worker without awaiting completion.
 * Safe to call from API routes (ideally wrapped in `after()` so it runs after
 * the response is sent). Never throws — failures are swallowed because the daily
 * cron and client-side poller act as fallbacks.
 */
export async function triggerBulkListingWorker(): Promise<void> {
  const base = resolveWorkerBaseUrl();
  if (!base) return;

  const headers: Record<string, string> = {};
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) headers.authorization = `Bearer ${cronSecret}`;

  try {
    await fetch(`${base}/api/cron/bulk-listing`, {
      method: "POST",
      headers,
      cache: "no-store",
    });
  } catch {
    // Best-effort. Fallbacks (daily cron, client poller) will pick up the rest.
  }
}
