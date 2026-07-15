import "server-only";

import { sendEmail } from "@/lib/email/send-email";
import { getAppOrigin } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  HuntProProduct,
  HuntProResult,
  HuntProStatistics,
} from "@/types/huntpro";

export const RANDOM_HOT_KEYWORD = "random-hot";

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

async function getUserEmail(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
  return data?.email?.trim() ?? null;
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

export async function getHuntingResultById(
  userId: string,
  resultId: string,
): Promise<HuntProResult | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("hunting_results")
    .select("*")
    .eq("id", resultId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (error.message.includes("does not exist")) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return mapResultRow(data as Record<string, unknown>);
}

export async function getLatestHuntingResult(
  userId: string,
  keyword?: string,
): Promise<HuntProResult | null> {
  const supabase = getSupabaseAdmin();
  const trimmedKeyword = keyword?.trim();

  // First try to match the keyword case-insensitively (the extension may store
  // a different case/whitespace than the page polls with).
  if (trimmedKeyword) {
    const { data, error } = await supabase
      .from("hunting_results")
      .select("*")
      .eq("user_id", userId)
      .ilike("keyword", trimmedKeyword)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && !error.message.includes("does not exist")) {
      throw new Error(error.message);
    }
    if (data) return mapResultRow(data as Record<string, unknown>);
  }

  // Fallback: return the user's latest result regardless of keyword, so a minor
  // keyword mismatch never leaves the page blank.
  const { data, error } = await supabase
    .from("hunting_results")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.message.includes("does not exist")) return null;
    throw new Error(error.message);
  }
  if (!data) return null;

  return mapResultRow(data as Record<string, unknown>);
}

/** Email the seller when a random/hot hunt batch is ready to view. */
export async function sendHuntProductsReadyEmail(input: {
  userId: string;
  resultId: string;
  productCount: number;
}): Promise<void> {
  const email = await getUserEmail(input.userId);
  if (!email) return;

  const viewUrl = `${getAppOrigin()}/dashboard/hunting?resultId=${encodeURIComponent(input.resultId)}`;
  const count = input.productCount;

  try {
    await sendEmail({
      to: email,
      subject: `Your hunt is ready — ${count} hot product${count === 1 ? "" : "s"}`,
      text: [
        `HuntPro found ${count} hot-selling product${count === 1 ? "" : "s"} for you.`,
        "",
        `View products: ${viewUrl}`,
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
          <p style="margin:0 0 12px">HuntPro found <strong>${count}</strong> hot-selling product${count === 1 ? "" : "s"} for you.</p>
          <p style="margin:0 0 20px">Open EcomTool to review them and start listing.</p>
          <a href="${viewUrl}" style="display:inline-block;background:#5842F4;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">
            View Products
          </a>
        </div>
      `,
    });
  } catch {
    // Best-effort — hunting result is already saved.
  }
}
