"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AdminUserDailyRequest } from "@/types/admin-users";

function formatDayLabel(day: string): string {
  const date = new Date(`${day}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function RequestsChart({ data }: { data: AdminUserDailyRequest[] }) {
  const chartData = data.map((point) => ({
    ...point,
    label: formatDayLabel(point.day),
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-white/20 text-sm text-white/50">
        No request data for the last 30 days.
      </div>
    );
  }

  return (
    <div className="h-72 w-full rounded-2xl border border-white/10 bg-black/20 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="label"
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              color: "#fff",
            }}
            labelFormatter={(_, payload) => {
              const item = payload?.[0]?.payload as { day?: string } | undefined;
              return item?.day ? formatDayLabel(item.day) : "";
            }}
          />
          <Bar dataKey="count" fill="#5842f4" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
