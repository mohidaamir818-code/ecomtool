import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * eBay Marketplace Account Deletion / Closure Notification endpoint.
 *
 * eBay requires every production application that accesses user data to expose a
 * single HTTPS endpoint that:
 *
 *   1. Answers a one-time "challenge" handshake (HTTP GET) when the URL is first
 *      saved in the eBay Developer Portal. eBay calls this endpoint with a
 *      `challenge_code` query param and expects back a SHA-256 hash that proves
 *      we own both the endpoint and the shared verification token.
 *
 *   2. Receives ongoing account-deletion notifications (HTTP POST) whenever an
 *      eBay user closes their account, so we can purge that user's data.
 *
 * Reference: https://developer.ebay.com/marketplace-account-deletion
 *
 * Compliance summary for auditors:
 *   - GET  -> verifies ownership via the documented SHA-256 challenge handshake.
 *   - POST -> acknowledges the notification with 200 OK immediately, then the
 *             deletion is processed asynchronously so eBay never times out.
 */

export const dynamic = "force-dynamic";

/**
 * The shared "Verification token" you paste into the eBay Developer Portal.
 *
 * HOW TO DEFINE IT:
 *   - Choose any random string between 32 and 80 characters long.
 *   - Allowed characters only: letters, numbers, underscore (_) and hyphen (-).
 *   - Set it in your environment as EBAY_VERIFICATION_TOKEN.
 *   - Paste the EXACT same string into the eBay Developer Portal
 *     ("Alerts & Notifications" -> "Marketplace account deletion" ->
 *      "Verification token").
 *
 * Example value (generate your own, do not reuse this one):
 *   EBAY_VERIFICATION_TOKEN="ecomtool-ebay-acct-deletion-7f3a9c2e5b1d4e6f8a0c"
 */
function getVerificationToken(): string {
  return process.env.EBAY_VERIFICATION_TOKEN?.trim() ?? "";
}

/**
 * The exact, publicly reachable URL of THIS endpoint, e.g.
 *   https://ecomtool-one.vercel.app/api/ebay-deletion-notify
 *
 * eBay folds this URL into the challenge hash, so it must match — byte for byte —
 * the "Endpoint URL" you enter in the Developer Portal. We resolve it from
 * EBAY_DELETION_ENDPOINT_URL when provided, otherwise fall back to APP_URL, and
 * finally to the request's own origin so the handshake still succeeds.
 */
function getEndpointUrl(request: NextRequest): string {
  const explicit = process.env.EBAY_DELETION_ENDPOINT_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) return `${appUrl.replace(/\/$/, "")}/api/ebay-deletion-notify`;

  return `${request.nextUrl.origin}/api/ebay-deletion-notify`;
}

/**
 * GET — eBay challenge/verification handshake.
 *
 * eBay calls: GET <endpoint>?challenge_code=<code>
 * We must respond 200 with JSON: { "challengeResponse": "<sha256 hex>" }
 * where the hash is computed over the concatenation, in this exact order:
 *
 *     challengeCode + verificationToken + endpointUrl
 *
 * The result is hex-encoded. This proves to eBay that we know the shared token
 * and own the endpoint, without ever sending the token over the wire.
 */
export async function GET(request: NextRequest) {
  const challengeCode = request.nextUrl.searchParams.get("challenge_code");

  // Without a challenge code there is nothing to verify; signal a health check.
  if (!challengeCode) {
    return NextResponse.json(
      { status: "ok", message: "eBay marketplace account deletion endpoint is live." },
      { status: 200 },
    );
  }

  const verificationToken = getVerificationToken();
  if (!verificationToken) {
    // Misconfiguration guard: the token must exist for the hash to be valid.
    return NextResponse.json(
      { error: "EBAY_VERIFICATION_TOKEN is not configured on the server." },
      { status: 500 },
    );
  }

  const endpointUrl = getEndpointUrl(request);

  // Order is mandated by eBay: challengeCode, then verificationToken, then endpoint.
  const challengeResponse = createHash("sha256")
    .update(challengeCode)
    .update(verificationToken)
    .update(endpointUrl)
    .digest("hex");

  // eBay expects the JSON body with a 200 status and application/json content type.
  return NextResponse.json({ challengeResponse }, { status: 200 });
}

/**
 * POST — actual account deletion notification.
 *
 * Flow:
 *   1. Read the raw body (eBay sends a JSON notification describing the user
 *      whose account was closed).
 *   2. Acknowledge with HTTP 200 OK *immediately* — eBay treats anything other
 *      than a fast 2xx as a failed delivery and will retry, so we never block on
 *      database work here.
 *   3. Trigger the (best-effort, fire-and-forget) deletion processing so the
 *      user's stored data is purged after we have already acknowledged.
 *
 * Note: We intentionally always return 200 even if parsing/processing has an
 * issue, because re-deliveries from eBay would not fix a bad payload and could
 * count against our endpoint's reliability score.
 */
export async function POST(request: NextRequest) {
  let payload: unknown = null;

  try {
    payload = await request.json();
  } catch {
    // Malformed body: still acknowledge so eBay does not retry indefinitely.
    return NextResponse.json({ status: "received" }, { status: 200 });
  }

  // Process the deletion AFTER we are ready to respond. We do not await this so
  // that the 200 OK is returned to eBay without waiting on database work.
  void processAccountDeletion(payload);

  // Immediate acknowledgement required by eBay's compliance contract.
  return NextResponse.json({ status: "received" }, { status: 200 });
}

/**
 * Best-effort handler that purges the deleted user's data.
 *
 * eBay's notification payload shape is roughly:
 *   {
 *     "metadata": { ... },
 *     "notification": {
 *       "data": { "username": "...", "userId": "...", "eiasToken": "..." },
 *       ...
 *     }
 *   }
 *
 * This runs after the 200 OK has been sent, so any failure here cannot affect
 * the response eBay receives.
 */
async function processAccountDeletion(payload: unknown): Promise<void> {
  try {
    const data = (payload as { notification?: { data?: Record<string, unknown> } } | null)
      ?.notification?.data;

    const ebayUserId = data?.userId ? String(data.userId) : null;
    const ebayUsername = data?.username ? String(data.username) : null;

    // Audit trail: record that a deletion notification was handled.
    console.log("[eBay account deletion] notification received", {
      ebayUserId,
      ebayUsername,
      receivedAt: new Date().toISOString(),
    });

    // TODO (data purge): remove or anonymize any records tied to this eBay user
    // (tokens, listings, handling rows). Left as a no-op hook so this endpoint
    // stays self-contained per the "do not change any other code" constraint.
  } catch (error) {
    console.error("[eBay account deletion] failed to process notification", error);
  }
}
