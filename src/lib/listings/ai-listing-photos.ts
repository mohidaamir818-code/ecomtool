import "server-only";

import { editNvidiaListingPhoto } from "@/lib/nvidia/image-generate";
import { uploadListingPhotoBytes } from "@/lib/listings/upload-photos";
import type { ListingPhotoDraft } from "@/types/listing-generator";

const MAX_AI_PHOTOS = 3;

/**
 * Generate up to 3 AI listing photos from seller prompt + product title.
 * Runs in parallel. Always attempts generation even if AliExpress URL download
 * would fail (Klein does not need the source file on NVIDIA trial keys).
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

  const urls = [...new Set(input.photoUrls.map((url) => url.trim()).filter(Boolean))];
  const count = Math.min(MAX_AI_PHOTOS, Math.max(1, input.count ?? MAX_AI_PHOTOS));

  const settled = await Promise.allSettled(
    Array.from({ length: count }, async (_, index) => {
      const edited = await editNvidiaListingPhoto({
        imageUrl: urls[index] ?? urls[0] ?? "",
        sellerPrompt: prompt,
        productTitle: input.productTitle,
        variantIndex: index,
      });
      const buffer = Buffer.from(edited.base64, "base64");
      const url = await uploadListingPhotoBytes(input.userId, buffer, {
        contentType: edited.mimeType,
        fileName: `ai-photo-${index + 1}.png`,
      });
      const photo: ListingPhotoDraft = { url, selected: true };
      return photo;
    }),
  );

  const photos: ListingPhotoDraft[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      photos.push(result.value);
    } else {
      console.warn("[AI photos] one photo failed:", result.reason);
    }
  }
  return photos;
}

/** Put AI photos first (selected); keep originals after as backups. */
export function mergeEditedPhotosIntoDraftPhotos(
  existing: ListingPhotoDraft[],
  editedPhotos: ListingPhotoDraft[],
): ListingPhotoDraft[] {
  if (editedPhotos.length === 0) return existing;

  const originals = existing.map((photo) => ({ ...photo, selected: false }));
  const merged = [...editedPhotos, ...originals];
  // Safety: never leave the draft with zero selected photos.
  if (!merged.some((photo) => photo.selected) && merged.length > 0) {
    return merged.map((photo) => ({ ...photo, selected: true }));
  }
  return merged;
}
