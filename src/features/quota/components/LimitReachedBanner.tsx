"use client";

import { QUOTA_EXCEEDED_MESSAGE } from "@/lib/quota/constants";
import { CountdownTimer } from "@/features/quota/components/CountdownTimer";

export function LimitReachedBanner({
  resetsAt,
  message = QUOTA_EXCEEDED_MESSAGE,
}: {
  resetsAt: string;
  message?: string;
}) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      <p className="font-medium">{message}</p>
      <p className="mt-1 text-amber-200/80">
        Resets in <CountdownTimer resetsAt={resetsAt} /> (UTC midnight)
      </p>
    </div>
  );
}
