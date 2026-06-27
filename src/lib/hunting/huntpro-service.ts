import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  HuntProProduct,
  HuntProResult,
  HuntProStatistics,
} from "@/types/huntpro";

const EMPTY_STATISTICS: HuntProStatistics = {
  totalSold: 0,
  avgPrice: 0,
  minPrice: 0,
  maxPrice: 0,
  totalRevenue: 0,
  dailyAverage: 0,
};

function mapResultRow(row: Record<string, unknown>): HuntProResult {
  return {
    id: String(row.id),
    keyword: String(row.keyword),
    source: String(row.source ?? "huntpro-extension"),
    statistics: (row.statistics as HuntProStatistics | null) ?? EMPTY_STATISTICS,
    products: (row.products as HuntProProduct[] | null) ?? [],
    createdAt: String(row.created_at),
  };
}

export async function saveHuntingResult(input: {
  userId: string;
  keyword: string;
  source: string;
  statistics: HuntProStatistics;
  products: HuntProProduct[];
}): Promise<HuntProResult> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("hunting_results")
    .insert({
      user_id: input.userId,
      keyword: input.keyword,
      source: input.source,
      statistics: input.statistics,
      products: input.products,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapResultRow(data as Record<string, unknown>);
}

export async function getLatestHuntingResult(
  userId: string,
  keyword?: string,
): Promise<HuntProResult | null> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("hunting_results")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (keyword?.trim()) {
    query = query.eq("keyword", keyword.trim());
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    if (error.message.includes("does not exist")) return null;
    throw new Error(error.message);
  }
  if (!data) return null;

  return mapResultRow(data as Record<string, unknown>);
}
