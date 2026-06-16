import "server-only";

import type {
  ProductHandlingStat,
  RecentRequest,
  StatCardData,
} from "@/features/dashboard/types";
import type { DashboardData, DashboardPlanOverview, DashboardRequestUsage } from "@/types/dashboard";
import { countCompetitorChecksThisWeek } from "@/lib/competitors/service";
import { countHandlingProducts } from "@/lib/handling/service";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const DAILY_REQUEST_LIMIT = 500;
const MONTHLY_REQUEST_LIMIT = 15_000;

function formatPrice(price: number, currency: string): string {
  if (currency === "GBP") return `£${price.toFixed(2)}`;
  if (currency === "USD") return `$${price.toFixed(2)}`;
  if (currency === "EUR") return `€${price.toFixed(2)}`;
  return `${currency} ${price.toFixed(2)}`;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString();
}

function mapHuntStatus(status: string): RecentRequest["status"] {
  const normalized = status.toLowerCase();
  if (normalized === "completed") return "Completed";
  if (normalized === "processing") return "Processing";
  if (normalized === "failed") return "Failed";
  return "Pending";
}

function getDayStart(date = new Date()): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getMonthStart(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getLast7DayLabels(): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - index));
    return day.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
}

function getDateRangeLabel(): string {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);

  const format = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return `${format(start)} – ${format(end)}`;
}

function countRequestsByDay(
  requests: { created_at: string }[],
  labels: string[],
): number[] {
  const counts = new Map<string, number>();

  for (const label of labels) {
    counts.set(label, 0);
  }

  for (const request of requests) {
    const label = new Date(request.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    if (counts.has(label)) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  return labels.map((label) => counts.get(label) ?? 0);
}

async function countUserRequests(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  since?: string,
): Promise<number> {
  let huntQuery = supabase
    .from("hunt_requests")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  let competitorQuery = supabase
    .from("competitor_checks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (since) {
    huntQuery = huntQuery.gte("created_at", since);
    competitorQuery = competitorQuery.gte("created_at", since);
  }

  const [huntResult, competitorResult] = await Promise.all([huntQuery, competitorQuery]);

  if (huntResult.error && !huntResult.error.message.includes("does not exist")) {
    throw new Error(huntResult.error.message);
  }

  if (competitorResult.error && !competitorResult.error.message.includes("does not exist")) {
    throw new Error(competitorResult.error.message);
  }

  return (huntResult.count ?? 0) + (competitorResult.count ?? 0);
}

function buildStatCards(input: {
  monthlyUsed: number;
  dailyUsed: number;
  handlingProducts: number;
  competitorChecks: number;
}): StatCardData[] {
  const monthlyRemaining = Math.max(MONTHLY_REQUEST_LIMIT - input.monthlyUsed, 0);
  const dailyRemaining = Math.max(DAILY_REQUEST_LIMIT - input.dailyUsed, 0);
  const monthlyPercent = Math.round((input.monthlyUsed / MONTHLY_REQUEST_LIMIT) * 100);
  const dailyPercent = Math.round((input.dailyUsed / DAILY_REQUEST_LIMIT) * 100);

  return [
    {
      title: "Remaining Requests",
      value:
        input.monthlyUsed > 0
          ? `${monthlyRemaining.toLocaleString()} of ${MONTHLY_REQUEST_LIMIT.toLocaleString()}`
          : `${MONTHLY_REQUEST_LIMIT.toLocaleString()} available`,
      subtitle: input.monthlyUsed === 0 ? "No requests used this month" : "Includes hunts and competitor checks",
      progress: monthlyPercent,
      progressColor: "bg-brand",
      icon: "send",
    },
    {
      title: "Products Handling",
      value:
        input.handlingProducts > 0
          ? `${input.handlingProducts} active`
          : "No handling products yet",
      subtitle: input.handlingProducts === 0 ? "Start handling products to see activity" : undefined,
      changeType: "neutral",
      icon: "box",
    },
    {
      title: "Competitor Checks",
      value:
        input.competitorChecks > 0
          ? `${input.competitorChecks} this week`
          : "No competitor check yet",
      subtitle: input.competitorChecks === 0 ? "Run a competitor check when available" : undefined,
      changeType: "neutral",
      icon: "users",
    },
    {
      title: "Requests Today",
      value: `${input.dailyUsed} of ${DAILY_REQUEST_LIMIT}`,
      subtitle: input.dailyUsed === 0
        ? "No requests today yet"
        : `${dailyRemaining} remaining today (hunts + competitor checks)`,
      progress: dailyPercent,
      progressColor: "bg-sky-400",
      icon: "clock",
    },
  ];
}

function buildProductHandlingStats(totalProducts: number): {
  stats: ProductHandlingStat[];
  isEmpty: boolean;
} {
  if (totalProducts === 0) {
    return {
      isEmpty: true,
      stats: [
        {
          label: "Active",
          value: "0",
          change: "—",
          changeType: "up",
          iconColor: "text-emerald-500 bg-emerald-50",
        },
        {
          label: "Processing",
          value: "0",
          change: "—",
          changeType: "up",
          iconColor: "text-orange-500 bg-orange-50",
        },
        {
          label: "Completed",
          value: "0",
          change: "—",
          changeType: "up",
          iconColor: "text-blue-500 bg-blue-50",
        },
      ],
    };
  }

  return {
    isEmpty: false,
    stats: [
      {
        label: "Active",
        value: String(totalProducts),
        change: "Saved",
        changeType: "up",
        iconColor: "text-emerald-500 bg-emerald-50",
      },
      {
        label: "Processing",
        value: "0",
        change: "—",
        changeType: "up",
        iconColor: "text-orange-500 bg-orange-50",
      },
      {
        label: "Completed",
        value: "0",
        change: "—",
        changeType: "up",
        iconColor: "text-blue-500 bg-blue-50",
      },
    ],
  };
}

function buildPlanOverview(monthlyUsed: number, dailyUsed: number): DashboardPlanOverview {
  const renewsOn = new Date();
  renewsOn.setMonth(renewsOn.getMonth() + 1);
  renewsOn.setDate(1);

  return {
    planName: "Free Plan",
    status: "Active",
    renewsOn: renewsOn.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    dailyLimit: DAILY_REQUEST_LIMIT,
    monthlyLimit: MONTHLY_REQUEST_LIMIT,
    dailyUsed,
    monthlyUsed,
  };
}

function buildRequestUsage(
  dailyUsed: number,
  monthlyUsed: number,
  chartDates: string[],
  chartValues: number[],
): DashboardRequestUsage {
  const usedPercent =
    dailyUsed > 0
      ? Math.max(Math.round((dailyUsed / DAILY_REQUEST_LIMIT) * 100), 1)
      : 0;

  return {
    usedPercent,
    dailyUsed,
    dailyLimit: DAILY_REQUEST_LIMIT,
    monthlyUsed,
    monthlyLimit: MONTHLY_REQUEST_LIMIT,
    chartDates,
    chartValues,
  };
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = getSupabaseAdmin();
  const chartDates = getLast7DayLabels();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();

  const { data: huntRequests, error: huntError } = await supabase
    .from("hunt_requests")
    .select("id, keyword, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (huntError && !huntError.message.includes("does not exist")) {
    throw new Error(huntError.message);
  }

  const requests = huntRequests ?? [];
  const todayStart = getDayStart().toISOString();
  const monthStart = getMonthStart().toISOString();
  const weekStartIso = weekStart.toISOString();

  const [dailyUsed, monthlyUsed, competitorChecks, handlingProducts] = await Promise.all([
    countUserRequests(supabase, userId, todayStart),
    countUserRequests(supabase, userId, monthStart),
    countCompetitorChecksThisWeek(userId),
    countHandlingProducts(userId),
  ]);

  const { data: competitorCheckRows } = await supabase
    .from("competitor_checks")
    .select("id, product_query, user_price, currency, matches_found, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: weekHuntRequests } = await supabase
    .from("hunt_requests")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", weekStartIso);

  const { data: weekCompetitorChecks } = await supabase
    .from("competitor_checks")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", weekStartIso);

  const weekActivity = [...(weekHuntRequests ?? []), ...(weekCompetitorChecks ?? [])];
  const chartValues = countRequestsByDay(weekActivity, chartDates);

  const huntRecentRequests = requests.slice(0, 8).map((request) => ({
    id: `hunt-${request.id}`,
    title: "Hunting Request" as const,
    subtitle: `Keyword: ${request.keyword}`,
    status: mapHuntStatus(String(request.status)),
    time: formatRelativeTime(String(request.created_at)),
    icon: "search" as const,
    sortAt: String(request.created_at),
  }));

  const competitorRecentRequests = (competitorCheckRows ?? []).map((check) => {
    const currency = String(check.currency ?? "GBP");
    const price = Number(check.user_price);

    return {
      id: `competitor-${check.id}`,
      title: "Competitor Check" as const,
      subtitle: `${check.product_query} · ${formatPrice(price, currency)}`,
      status: (Number(check.matches_found) > 0 ? "Processing" : "Completed") as RecentRequest["status"],
      time: formatRelativeTime(String(check.created_at)),
      icon: "users" as const,
      sortAt: String(check.created_at),
    };
  });

  const recentRequests: RecentRequest[] = [...huntRecentRequests, ...competitorRecentRequests]
    .sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime())
    .slice(0, 8)
    .map(({ sortAt: _sortAt, ...request }) => request);

  const productHandling = buildProductHandlingStats(handlingProducts);

  return {
    userName: profile?.full_name ? String(profile.full_name) : "User",
    statCards: buildStatCards({
      monthlyUsed,
      dailyUsed,
      handlingProducts,
      competitorChecks,
    }),
    requestUsage: buildRequestUsage(dailyUsed, monthlyUsed, chartDates, chartValues),
    productHandlingStats: productHandling.stats,
    productHandlingEmpty: productHandling.isEmpty,
    recentRequests,
    planOverview: buildPlanOverview(monthlyUsed, dailyUsed),
    dateRangeLabel: getDateRangeLabel(),
  };
}
