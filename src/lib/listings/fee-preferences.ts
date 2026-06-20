import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ListingPricingPreferences } from "@/types/listing-generator";
import { defaultFeePreferencesForCurrency } from "@/types/listing-generator";

export async function getFeePreferences(userId: string, currency = "GBP"): Promise<ListingPricingPreferences> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("listing_fee_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return defaultFeePreferencesForCurrency(currency);

  return {
    ebayFinalValueFeePercent: Number(data.ebay_final_value_fee_percent ?? 13.25),
    ebayTransactionFee: Number(data.ebay_transaction_fee ?? 0.3),
    paymentFeePercent: Number(data.payment_fee_percent ?? 2.9),
    profitMarginPercent: Number(data.profit_margin_percent ?? 30),
    shippingCost: Number(data.shipping_cost ?? 0),
    currency: String(data.currency ?? currency),
  };
}

export async function saveFeePreferences(
  userId: string,
  prefs: ListingPricingPreferences,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("listing_fee_preferences").upsert(
    {
      user_id: userId,
      ebay_final_value_fee_percent: prefs.ebayFinalValueFeePercent,
      ebay_transaction_fee: prefs.ebayTransactionFee,
      payment_fee_percent: prefs.paymentFeePercent,
      profit_margin_percent: prefs.profitMarginPercent,
      shipping_cost: prefs.shippingCost,
      currency: prefs.currency,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    if (error.message.includes("does not exist")) {
      throw new Error("Run supabase/migrations/017_listing_fee_preferences.sql in Supabase.");
    }
    throw new Error(error.message);
  }
}
