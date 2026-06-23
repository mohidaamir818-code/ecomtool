import type { ListingPlatform } from "@/types/listing-generator";

export function listingPlatformLabel(platform: ListingPlatform): string {
  return platform === "amazef" ? "Amazef" : "eBay";
}

export function localizeVeroText(text: string, platform: ListingPlatform): string {
  if (platform === "amazef") {
    return text.replace(/\beBay(?:\s+UK)?\b/gi, "Amazef");
  }
  return text.replace(/\bAmazef\b/gi, "eBay");
}
