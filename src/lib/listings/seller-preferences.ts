import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { SellerPreferences } from "@/types/listing-generator";

export {
  feePrefsToSellerPreferences,
  promotionsToSellerPreferences,
  sellerPreferencesToFeePrefs,
  sellerPreferencesToPromotions,
} from "@/lib/listings/seller-preferences-mappers";

function mapRowToSellerPreferences(
  row: Record<string, unknown>,
  currency: string,
): SellerPreferences {
  return {
    ebayFinalValueFeePercent: Number(row.ebay_final_value_fee_percent ?? 13.25),
    transactionFeeAmount: Number(row.transaction_fee_amount ?? 0.3),
    paymentFeePercent: Number(row.payment_fee_percent ?? 2.9),
    profitMarginPercent: Number(row.profit_margin_percent ?? 30),
    shippingCost: Number(row.shipping_cost ?? 0),
    currency: String(row.currency ?? currency),
    buy2DiscountPercent: Number(row.buy_2_discount_percent ?? 0),
    buy3DiscountPercent: Number(row.buy_3_discount_percent ?? 0),
    buy5DiscountPercent: Number(row.buy_5_discount_percent ?? 0),
    buy10DiscountPercent: Number(row.buy_10_discount_percent ?? 0),
    buy2Enabled: Boolean(row.buy_2_enabled),
    buy3Enabled: Boolean(row.buy_3_enabled),
    buy5Enabled: Boolean(row.buy_5_enabled),
    buy10Enabled: Boolean(row.buy_10_enabled),
  };
}

export async function getSellerPreferences(
  userId: string,
  currency = "GBP",
): Promise<SellerPreferences | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("seller_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (error.message.includes("does not exist")) return null;
    throw new Error(error.message);
  }

  if (!data) return null;
  return mapRowToSellerPreferences(data, currency);
}

export async function saveSellerPreferences(
  userId: string,
  prefs: SellerPreferences,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("seller_preferences").upsert(
    {
      user_id: userId,
      ebay_final_value_fee_percent: prefs.ebayFinalValueFeePercent,
      transaction_fee_amount: prefs.transactionFeeAmount,
      payment_fee_percent: prefs.paymentFeePercent,
      profit_margin_percent: prefs.profitMarginPercent,
      shipping_cost: prefs.shippingCost,
      currency: prefs.currency,
      buy_2_discount_percent: prefs.buy2DiscountPercent,
      buy_3_discount_percent: prefs.buy3DiscountPercent,
      buy_5_discount_percent: prefs.buy5DiscountPercent,
      buy_10_discount_percent: prefs.buy10DiscountPercent,
      buy_2_enabled: prefs.buy2Enabled,
      buy_3_enabled: prefs.buy3Enabled,
      buy_5_enabled: prefs.buy5Enabled,
      buy_10_enabled: prefs.buy10Enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    if (error.message.includes("does not exist")) {
      throw new Error("Run supabase/migrations/018_seller_preferences.sql in Supabase.");
    }
    throw new Error(error.message);
  }
}
