import type { SellerPreferences } from "@/types/listing-generator";

export async function fetchSellerPreferences(
  userId: string,
  currency = "GBP",
): Promise<{ preferences: SellerPreferences; hasSaved: boolean }> {
  const params = new URLSearchParams({ userId, currency });
  const response = await fetch(`/api/seller/preferences?${params.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load preferences.");
  }

  return {
    preferences: data.preferences as SellerPreferences,
    hasSaved: Boolean(data.hasSaved),
  };
}

export async function persistSellerPreferences(
  userId: string,
  preferences: SellerPreferences,
): Promise<void> {
  const response = await fetch("/api/seller/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, preferences }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to save preferences.");
  }
}
