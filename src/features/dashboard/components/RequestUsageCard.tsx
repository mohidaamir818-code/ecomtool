import type { DashboardRequestUsage } from "@/types/dashboard";

function buildChartPath(values: number[], width = 400, height = 100): string {
  if (values.every((value) => value === 0)) {
    return `M0,${height - 12} L${width},${height - 12}`;
  }

  const max = Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - (value / max) * (height - 24) - 12;
    return `${x},${y}`;
  });

  return `M${points.join(" L")}`;
}

function buildAreaPath(linePath: string, width = 400, height = 100): string {
  if (linePath.startsWith("M0,")) {
    return `${linePath} L${width},${height} L0,${height} Z`;
  }

  const lastPoint = linePath.split(" ").pop() ?? `0,${height - 12}`;
  return `${linePath} L${width},${height} L0,${height} Z`;
}

export function RequestUsageCard({ usage }: { usage: DashboardRequestUsage }) {
  const linePath = buildChartPath(usage.chartValues);
  const areaPath = buildAreaPath(linePath);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#111827]">Request Usage</h3>
        <span className="text-xs text-[#9CA3AF]">Last 7 days</span>
      </div>

      {usage.dailyUsed === 0 && usage.chartValues.every((value) => value === 0) ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-[#FAFAFA] px-6 text-center">
          <p className="text-sm font-semibold text-[#374151]">No request usage yet</p>
          <p className="mt-1 text-xs text-[#9CA3AF]">
            Hunts and competitor checks will appear here once you start using the platform.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[140px_1fr]">
          <div className="flex flex-col items-center justify-center">
            <div className="relative h-32 w-32">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden>
                <circle cx="18" cy="18" r="14" fill="none" stroke="#F3F4F6" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#5842F4"
                  strokeWidth="3"
                  strokeDasharray={`${usage.usedPercent} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-[#111827]">{usage.usedPercent}%</span>
                <span className="text-xs text-[#9CA3AF]">Used today</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-[#9CA3AF]">
              {usage.dailyUsed} of {usage.dailyLimit} daily requests (hunts + competitor checks)
            </p>
          </div>

          <div>
            <svg viewBox="0 0 400 100" className="h-36 w-full" preserveAspectRatio="none" aria-hidden>
              <defs>
                <linearGradient id="dashChartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5842F4" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#5842F4" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#dashChartFill)" />
              <path
                d={linePath}
                fill="none"
                stroke="#5842F4"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            <div className="mt-1 flex justify-between text-[10px] text-[#9CA3AF]">
              {usage.chartDates.map((date) => (
                <span key={date}>{date}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
