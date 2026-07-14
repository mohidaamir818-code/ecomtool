import "server-only";

import { generateAiVisionJson } from "@/lib/gemini/client";
import type { ListingPhotoDraft } from "@/types/listing-generator";

const BATCH_SIZE = 3;
const MAX_IMAGES_TO_SCAN = 24;
const MAX_PARALLEL_BATCHES = 4;

const DESCRIPTION_IMAGE_FLAG_PROMPT = `You are checking product DESCRIPTION images before an eBay listing.

For EACH image (in order, index starting at 0), set flagged=true if the image shows ANY of these as readable text, watermarks, badges, packaging stamps, or logos:
- Country / origin names or labels (China, Made in China, Mainland China, USA, UK, Turkey, etc.)
- Marketplace / platform names (AliExpress, Alibaba, Amazon, Temu, Shein, Wish, eBay seller watermarks, 1688, Dhgate, etc.)
- Dropshipping / wholesale wording (dropship, drop shipping, wholesale, supplier warehouse, factory direct, etc.)

Do NOT flag normal product photos with no such text/logos.
If unsure, flagged=false.

Return ONLY JSON:
{"results":[{"index":0,"flagged":false,"reason":null},{"index":1,"flagged":true,"reason":"Visible Made in China text"}]}`;

interface VisionBatchResult {
  results?: Array<{
    index?: number;
    flagged?: boolean;
    reason?: string | null;
  }>;
}

function heuristicFlagReason(url: string): string | null {
  const lower = url.toLowerCase();
  if (/made[_-]?in[_-]?china|mainland[_-]?china/.test(lower)) {
    return "URL suggests China origin branding";
  }
  if (/drop\s*ship|dropshipping|wholesale|1688|dhgate|temu|shein/.test(lower)) {
    return "URL suggests marketplace or dropshipping content";
  }
  return null;
}

async function scanBatch(
  batch: Array<{ url: string; globalIndex: number }>,
): Promise<Map<number, { flagged: boolean; reason: string | null }>> {
  const map = new Map<number, { flagged: boolean; reason: string | null }>();
  if (batch.length === 0) return map;

  try {
    const raw = await generateAiVisionJson<VisionBatchResult>(
      batch.map((entry) => entry.url),
      DESCRIPTION_IMAGE_FLAG_PROMPT,
    );

    for (const result of raw.results ?? []) {
      const localIndex = typeof result.index === "number" ? result.index : -1;
      const entry = batch[localIndex];
      if (!entry) continue;
      map.set(entry.globalIndex, {
        flagged: Boolean(result.flagged),
        reason: result.flagged ? result.reason?.trim() || "Restricted text/logo detected in image" : null,
      });
    }
  } catch {
    // Vision unavailable — leave heuristic-only flags.
  }

  return map;
}

/**
 * AI-checks description photos for country / platform / dropshipping content.
 * Flagged photos stay in the draft (shown to the seller) but are unchecked by default.
 * Seller can still tick them to include when listing.
 */
export async function flagDescriptionPhotos(
  photos: ListingPhotoDraft[],
): Promise<ListingPhotoDraft[]> {
  if (photos.length === 0) return photos;

  const scanTargets = photos.slice(0, MAX_IMAGES_TO_SCAN).map((photo, index) => ({
    url: photo.url,
    globalIndex: index,
    heuristic: heuristicFlagReason(photo.url),
  }));

  const batches: Array<Array<{ url: string; globalIndex: number }>> = [];
  for (let i = 0; i < scanTargets.length; i += BATCH_SIZE) {
    batches.push(
      scanTargets.slice(i, i + BATCH_SIZE).map((entry) => ({
        url: entry.url,
        globalIndex: entry.globalIndex,
      })),
    );
  }

  const aiFlags = new Map<number, { flagged: boolean; reason: string | null }>();

  for (let i = 0; i < batches.length; i += MAX_PARALLEL_BATCHES) {
    const wave = batches.slice(i, i + MAX_PARALLEL_BATCHES);
    const waveResults = await Promise.all(wave.map((batch) => scanBatch(batch)));
    for (const map of waveResults) {
      for (const [index, value] of map) aiFlags.set(index, value);
    }
  }

  return photos.map((photo, index) => {
    const ai = aiFlags.get(index);
    const heuristic = scanTargets.find((entry) => entry.globalIndex === index)?.heuristic ?? null;
    const flagged = Boolean(ai?.flagged) || Boolean(heuristic);
    const flagReason = ai?.flagged
      ? ai.reason
      : heuristic
        ? heuristic
        : null;

    if (!flagged) {
      return {
        ...photo,
        flagged: false,
        flagReason: null,
        selected: photo.selected,
      };
    }

    return {
      ...photo,
      flagged: true,
      flagReason: flagReason || "Possible country, platform, or dropshipping content",
      // Unchecked by default — seller can turn on to list.
      selected: false,
    };
  });
}
