import "server-only";

import { editNvidiaListingPhoto } from "@/lib/nvidia/image-generate";
import { uploadListingPhotoBytes } from "@/lib/listings/upload-photos";
import type { ListingPhotoDraft } from "@/types/listing-generator";

const MAX_EDIT_PHOTOS = 3;
/** Soft budget so prepare stays inside ~30–55s even if NVIDIA is slow. */
const EDIT_BUDGET_MS = 18_000;

/**
 * Edit up to 3 AliExpress photos with the seller prompt (parallel).
 * Failures / timeout → empty result; originals stay on the draft.
 */
export async function editAliExpressListingPhotos(input: {
  userId: string;
  photoUrls: string[];
  sellerPrompt: string;
  productTitle: string;
  count?: number;
}): Promise<ListingPhotoDraft[]> {
  const prompt = input.sellerPrompt.trim();
  if (!prompt) return [];

  const urls = [...new Set(input.photoUrls.map((url) => url.trim()).filter(Boolean))].slice(
    0,
    Math.min(MAX_EDIT_PHOTOS, Math.max(1, input.count ?? MAX_EDIT_PHOTOS)),
  );
  if (urls.length === 0) return [];

  const work = Promise.allSettled(
    urls.map(async (imageUrl, index) => {
      const edited = await editNvidiaListingPhoto({
        imageUrl,
        sellerPrompt: prompt,
        productTitle: input.productTitle,
      });
      const buffer = Buffer.from(edited.base64, "base64");
      const url = await uploadListingPhotoBytes(input.userId, buffer, {
        contentType: edited.mimeType,
        fileName: `ai-edit-${index + 1}.${edited.mimeType.includes("png") ? "png" : "jpg"}`,
      });
      const photo: ListingPhotoDraft = { url, selected: true };
      return photo;
    }),
  );

  const settled = await Promise.race([
    work,
    new Promise<PromiseSettledResult<ListingPhotoDraft>[]>((resolve) => {
      setTimeout(() => resolve([]), EDIT_BUDGET_MS);
    }),
  ]);

  const photos: ListingPhotoDraft[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") photos.push(result.value);
  }
  return photos;
}

/** Replace the first N selected/draft photos with AI-edited versions; keep originals after. */
export function mergeEditedPhotosIntoDraftPhotos(
  existing: ListingPhotoDraft[],
  editedPhotos: ListingPhotoDraft[],
): ListingPhotoDraft[] {
  if (editedPhotos.length === 0) return existing;

  const originals = existing.map((photo) => ({ ...photo, selected: false }));
  return [...editedPhotos, ...originals];
}
