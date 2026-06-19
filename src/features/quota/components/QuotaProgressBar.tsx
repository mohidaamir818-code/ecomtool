"use client";

function getProgressColor(percent: number): string {
  if (percent >= 85) return "bg-red-500";
  if (percent >= 60) return "bg-amber-400";
  return "bg-emerald-500";
}

export function QuotaProgressBar({
  used,
  limit,
  unlimited = false,
  variant = "light",
}: {
  used: number;
  limit: number | null;
  unlimited?: boolean;
  variant?: "light" | "dark";
}) {
  if (unlimited || limit === null) {
    return (
      <div
        className={`h-2 w-full overflow-hidden rounded-full ${
          variant === "dark" ? "bg-white/10" : "bg-gray-100"
        }`}
      >
        <div className="h-full w-full bg-[#5842f4]" />
      </div>
    );
  }

  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full ${
        variant === "dark" ? "bg-white/10" : "bg-gray-100"
      }`}
    >
      <div
        className={`h-full rounded-full transition-all ${getProgressColor(percent)}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
