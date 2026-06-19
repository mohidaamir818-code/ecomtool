"use client";

import { useUserBlock } from "@/features/dashboard/context/UserBlockContext";

export function BlockedAccountBanner() {
  const { isBlocked, blockReason } = useUserBlock();

  if (!isBlocked) return null;

  return (
    <div className="border-b border-red-200 bg-red-600 px-6 py-4 text-white">
      <p className="text-sm font-semibold">
        Your account is blocked for this reason: {blockReason ?? "Contact support for assistance."}
      </p>
      <p className="mt-2 text-xs text-red-100/80">
        All features are disabled. Use the Help button if you need assistance.
      </p>
    </div>
  );
}
