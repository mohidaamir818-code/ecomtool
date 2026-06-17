import Link from "next/link";
import { getAliExpressTokenStatus } from "@/lib/aliexpress/oauth";

interface ConnectPageProps {
  searchParams: Promise<{
    status?: string;
    message?: string;
  }>;
}

export default async function AliExpressConnectPage({ searchParams }: ConnectPageProps) {
  const params = await searchParams;
  const tokenStatus = await getAliExpressTokenStatus();
  const noticeType = params.status === "success" ? "success" : params.status === "error" ? "error" : null;

  return (
    <section className="bg-gray-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Connect AliExpress</h1>
        <p className="mt-2 text-sm text-gray-600">
          Start OAuth once to enable the official Dropship API token flow.
        </p>

        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>
            <span className="font-semibold">Connected:</span>{" "}
            {tokenStatus.connected ? "Yes" : "No"}
          </p>
          <p className="mt-1">
            <span className="font-semibold">Access token expires:</span>{" "}
            {tokenStatus.accessTokenExpiresAt
              ? new Date(tokenStatus.accessTokenExpiresAt).toLocaleString()
              : "Unknown"}
          </p>
          <p className="mt-1">
            <span className="font-semibold">Refresh token expires:</span>{" "}
            {tokenStatus.refreshTokenExpiresAt
              ? new Date(tokenStatus.refreshTokenExpiresAt).toLocaleString()
              : "Unknown"}
          </p>
        </div>

        {noticeType && params.message ? (
          <div
            className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
              noticeType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {params.message}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/api/aliexpress/login"
            className="inline-flex items-center rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Connect with AliExpress
          </Link>
          <Link
            href="/api/aliexpress/status"
            className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            View OAuth Status JSON
          </Link>
        </div>
      </div>
    </section>
  );
}
