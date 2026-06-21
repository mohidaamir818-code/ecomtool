import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { EbaySellerInventoryLocation } from "@/types/listing-generator";

function mapRow(row: Record<string, unknown>): EbaySellerInventoryLocation {
  return {
    sellerId: String(row.seller_id),
    city: String(row.city),
    postalCode: String(row.postal_code),
    country: String(row.country),
    merchantLocationKey: String(row.merchant_location_key),
    addressConfirmed: Boolean(row.address_confirmed),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function getSellerInventoryLocation(
  sellerId: string,
): Promise<EbaySellerInventoryLocation | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ebay_seller_inventory_locations")
    .select("*")
    .eq("seller_id", sellerId)
    .maybeSingle();

  if (error) {
    if (error.message.includes("does not exist")) return null;
    throw new Error(error.message);
  }

  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function insertSellerInventoryLocation(input: {
  sellerId: string;
  city: string;
  postalCode: string;
  country: string;
  merchantLocationKey: string;
}): Promise<EbaySellerInventoryLocation> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ebay_seller_inventory_locations")
    .insert({
      seller_id: input.sellerId,
      city: input.city,
      postal_code: input.postalCode,
      country: input.country,
      merchant_location_key: input.merchantLocationKey,
      address_confirmed: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function updateSellerInventoryLocation(input: {
  sellerId: string;
  city: string;
  postalCode: string;
  country: string;
}): Promise<EbaySellerInventoryLocation> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ebay_seller_inventory_locations")
    .update({
      city: input.city,
      postal_code: input.postalCode,
      country: input.country,
    })
    .eq("seller_id", input.sellerId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}
