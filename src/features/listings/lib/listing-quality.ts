import type { ListingDraft, ListingPlatform, ListingQualityCheck, ListingQualityScore } from "@/types/listing-generator";
import { countFilledItemSpecifics } from "@/lib/listings/item-specifics";
import { getEnabledPromotions, getSelectedPhotos } from "@/features/listings/lib/draft-utils";
import { listingPlatformLabel } from "@/features/listings/lib/vero-platform";

function countDescriptionPlainTextLength(html: string): number {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().length;
}

function scoreTitleLength(len: number): { points: number; passed: boolean } {
  if (len >= 75) return { points: 20, passed: true };
  if (len >= 60) return { points: 15, passed: false };
  if (len >= 40) return { points: 10, passed: false };
  return { points: 5, passed: false };
}

function scorePhotoCount(count: number): { points: number; passed: boolean } {
  if (count >= 8) return { points: 20, passed: true };
  if (count >= 5) return { points: 15, passed: false };
  if (count >= 3) return { points: 10, passed: false };
  if (count >= 1) return { points: 5, passed: false };
  return { points: 0, passed: false };
}

function scoreDescriptionLength(len: number): { points: number; passed: boolean } {
  if (len >= 500) return { points: 15, passed: true };
  if (len >= 300) return { points: 10, passed: false };
  if (len >= 100) return { points: 5, passed: false };
  return { points: 0, passed: false };
}

export function computeListingQualityScore(
  draft: ListingDraft,
  platform: ListingPlatform = "ebay",
): ListingQualityScore {
  const platformName = listingPlatformLabel(platform);
  const checks: ListingQualityCheck[] = [];
  const tips: string[] = [];

  const titleLen = draft.listing.seoTitle.trim().length;
  const titleScore = scoreTitleLength(titleLen);
  checks.push({
    id: "title",
    label: "Title length",
    passed: titleScore.passed,
    points: titleScore.points,
    maxPoints: 20,
    detail: `${titleLen}/80 characters`,
    tip: titleScore.passed ? undefined : "Expand your title to 75–80 characters with keywords at the start.",
  });
  if (!titleScore.passed) {
    tips.push(`Expand your title to 75–80 characters for maximum ${platformName} visibility.`);
  }

  const photoCount = getSelectedPhotos(draft).length;
  const photoScore = scorePhotoCount(photoCount);
  checks.push({
    id: "photos",
    label: "Photos",
    passed: photoScore.passed,
    points: photoScore.points,
    maxPoints: 20,
    detail: photoCount >= 8 ? `${photoCount} photos` : `${photoCount} photos (need 8+)`,
    tip: photoScore.passed ? undefined : "Select at least 8 photos for better conversion.",
  });
  if (!photoScore.passed) {
    tips.push("Add more product photos — listings with 8+ images perform better.");
  }

  const descLen = countDescriptionPlainTextLength(draft.listing.descriptionHtml);
  const descScore = scoreDescriptionLength(descLen);
  checks.push({
    id: "description",
    label: "Description length",
    passed: descScore.passed,
    points: descScore.points,
    maxPoints: 15,
    detail: descLen >= 500 ? `${descLen} characters` : `${descLen} characters (need 500+)`,
    tip: descScore.passed ? undefined : "Write at least 500 characters with bullet features and a guarantee.",
  });
  if (!descScore.passed) {
    tips.push("Expand your description with features, compatibility, and what's in the box.");
  }

  const specificsCount = countFilledItemSpecifics(draft.listing.itemSpecifics);
  const specificsPassed = specificsCount >= 10;
  checks.push({
    id: "specifics",
    label: "Item specifics",
    passed: specificsPassed,
    points: specificsCount >= 10 ? 15 : specificsCount >= 6 ? 8 : specificsCount >= 3 ? 4 : 0,
    maxPoints: 15,
    tip: specificsPassed ? undefined : "Fill in at least 10 item specifics to improve search ranking.",
  });
  if (!specificsPassed) {
    tips.push(`Fill in more item specifics — ${platformName} uses these for search ranking.`);
  }

  const variantsOk = draft.variants.every(
    (v) => v.price > 0 && v.quantity >= 1 && v.imageUrl,
  );
  checks.push({
    id: "variants",
    label: "Variants",
    passed: variantsOk && draft.variants.length > 0,
    points: variantsOk && draft.variants.length > 0 ? 20 : 0,
    maxPoints: 20,
    tip: variantsOk ? undefined : "Ensure each variant has a photo, price, and stock.",
  });

  const hasDeals = getEnabledPromotions(draft.promotions).length > 0;
  checks.push({
    id: "deals",
    label: "Volume discount",
    passed: hasDeals,
    points: hasDeals ? 10 : 0,
    maxPoints: 10,
    tip: hasDeals ? undefined : "Enable a volume discount to encourage multi-unit orders.",
  });
  if (!hasDeals) tips.push("Consider adding a Buy 2+ volume discount.");

  const total = checks.reduce((sum, c) => sum + c.points, 0);
  const maxTotal = checks.reduce((sum, c) => sum + c.maxPoints, 0);

  return { total, maxTotal, checks, tips };
}
