import type { ListingDraft, ListingQualityCheck, ListingQualityScore } from "@/types/listing-generator";
import { countFilledItemSpecifics } from "@/lib/listings/item-specifics";
import { getEnabledPromotions, getSelectedPhotos } from "@/features/listings/lib/draft-utils";

function countDescriptionWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(" ").length : 0;
}

export function computeListingQualityScore(draft: ListingDraft): ListingQualityScore {
  const checks: ListingQualityCheck[] = [];
  const tips: string[] = [];

  const titleLen = draft.listing.seoTitle.length;
  const titlePassed = titleLen === 80;
  checks.push({
    id: "title",
    label: "Title length",
    passed: titlePassed,
    points: titlePassed ? 20 : titleLen >= 60 ? 12 : 0,
    maxPoints: 20,
    tip: titlePassed ? undefined : "Use all 80 characters with keywords at the start.",
  });
  if (!titlePassed) tips.push("Expand your title to exactly 80 characters for maximum eBay visibility.");

  const photoCount = getSelectedPhotos(draft).length;
  const photosPassed = photoCount >= 8;
  checks.push({
    id: "photos",
    label: "Photos",
    passed: photosPassed,
    points: photoCount >= 8 ? 20 : photoCount >= 4 ? 12 : photoCount >= 1 ? 6 : 0,
    maxPoints: 20,
    tip: photosPassed ? undefined : "Select at least 8 photos for better conversion.",
  });
  if (!photosPassed) tips.push("Add more product photos — listings with 8+ images perform better.");

  const wordCount = countDescriptionWords(draft.listing.descriptionHtml);
  const descPassed = wordCount >= 150;
  checks.push({
    id: "description",
    label: "Description length",
    passed: descPassed,
    points: descPassed ? 15 : wordCount >= 80 ? 8 : wordCount >= 40 ? 4 : 0,
    maxPoints: 15,
    tip: descPassed ? undefined : "Write at least 150 words with bullet features and a guarantee.",
  });
  if (!descPassed) tips.push("Expand your description with features, compatibility, and what's in the box.");

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
  if (!specificsPassed) tips.push("Fill in more item specifics — eBay uses these for search ranking.");

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
