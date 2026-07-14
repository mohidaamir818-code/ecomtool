import "server-only";

import { generateNvidiaProductImage } from "@/lib/nvidia/image-generate";
import { uploadListingPhotoBytes } from "@/lib/listings/upload-photos";
import type { ListingPhotoDraft } from "@/types/listing-generator";

const MAX_AI_PHOTOS = 3;

function buildProductPhotoPrompt(title: string, index: number): string {
  const angle =
    index === 0
      ? "front hero shot"
      : index === 1
        ? "slight 45-degree angle"
        : "detail close-up shot";

  return [
    "Professional ecommerce product photograph for online marketplace listing.",
    "Clean pure white background, soft studio lighting, sharp focus, no watermark, no text, no logo overlay.",
    `Product: ${title.slice(0, 180)}.`,
    `Camera: ${angle}.`,
    "Photorealistic, high resolution, marketplace-ready.",
  ].join(" ");
}

/**
 * Runs NVIDIA text→image in parallel with listing AI.
 * Failures are silent — original AliExpress photos still work for preview.
 */
export async function generateAiListingPhotos(input: {
  userId: string;
  title: string;
  count?: number;
}): Promise<ListingPhotoDraft[]> {
  const count = Math.min(MAX_AI_PHOTOS, Math.max(1, input.count ?? 3));
  const prompts = Array.from({ length: count }, (_, index) =>
    buildProductPhotoPrompt(input.title, index),
  );

  const results = await Promise.allSettled(
    prompts.map(async (prompt, index) => {
      const generated = await generateNvidiaProductImage(prompt);
      const buffer = Buffer.from(generated.base64, "base64");
      const url = await uploadListingPhotoBytes(input.userId, buffer, {
        contentType: generated.mimeType,
        fileName: `ai-photo-${index + 1}.png`,
      });
      const photo: ListingPhotoDraft = {
        url,
        selected: true,
      };
      return photo;
    }),
  );

  const photos: ListingPhotoDraft[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") photos.push(result.value);
  }
  return photos;
}

export function mergeAiPhotosIntoDraftPhotos(
  existing: ListingPhotoDraft[],
  aiPhotos: ListingPhotoDraft[],
): ListingPhotoDraft[] {
  if (aiPhotos.length === 0) return existing;

  // AI photos first (selected), keep originals after so seller can still use them.
  const originals = existing.map((photo, index) => ({
    ...photo,
    // Keep first few originals selected too for review flexibility
    selected: photo.selected || index < 2,
  }));

  return [...aiPhotos, ...originals];
}
