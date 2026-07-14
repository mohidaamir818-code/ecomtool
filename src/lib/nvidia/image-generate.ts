import "server-only";

import { serverEnv } from "@/lib/env";

const NVIDIA_IMAGE_URL =
  process.env.NVIDIA_IMAGE_API_URL?.trim() ||
  "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b";

export interface NvidiaImageResult {
  base64: string;
  mimeType: string;
}

function extractBase64(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;

  if (typeof data.image === "string" && data.image.trim()) {
    return data.image.replace(/^data:image\/\w+;base64,/, "");
  }
  if (typeof data.b64_json === "string" && data.b64_json.trim()) {
    return data.b64_json.trim();
  }

  const artifacts = data.artifacts;
  if (Array.isArray(artifacts) && artifacts[0] && typeof artifacts[0] === "object") {
    const first = artifacts[0] as Record<string, unknown>;
    if (typeof first.base64 === "string" && first.base64.trim()) {
      return first.base64.replace(/^data:image\/\w+;base64,/, "");
    }
  }

  if (Array.isArray(data.images) && typeof data.images[0] === "string") {
    return data.images[0].replace(/^data:image\/\w+;base64,/, "");
  }

  return null;
}

/**
 * Fast text → image via NVIDIA FLUX.2-klein-4b (~2–3s).
 * This is the reliable path on NVIDIA trial/build keys.
 */
export async function generateNvidiaProductImage(prompt: string): Promise<NvidiaImageResult> {
  const apiKey = serverEnv.nvidiaApiKey();
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not configured.");
  }

  const response = await fetch(NVIDIA_IMAGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: prompt.slice(0, 1200),
      width: 1024,
      height: 1024,
      seed: Math.floor(Math.random() * 1_000_000),
      steps: 4,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`NVIDIA image API failed (${response.status}): ${rawText.slice(0, 400)}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error("NVIDIA image API returned invalid JSON.");
  }

  const base64 = extractBase64(json);
  if (!base64) {
    throw new Error("NVIDIA image API returned no image data.");
  }

  return { base64, mimeType: "image/png" };
}

/**
 * Build listing photos from seller prompt + product title.
 * Uses Klein text→image (Kontext edit is blocked on NVIDIA trial keys).
 */
export async function editNvidiaListingPhoto(input: {
  imageUrl: string;
  sellerPrompt: string;
  productTitle: string;
  variantIndex?: number;
}): Promise<NvidiaImageResult> {
  const angle =
    input.variantIndex === 1
      ? "slight three-quarter angle"
      : input.variantIndex === 2
        ? "detail / close-up angle"
        : "front hero shot";

  const prompt = [
    "Professional ecommerce product photograph for marketplace listing.",
    `Product: ${input.productTitle.slice(0, 180)}.`,
    `Seller style instructions: ${input.sellerPrompt.trim()}.`,
    `Camera: ${angle}.`,
    "Photorealistic, sharp, no watermark, no text overlay, no chinese labels.",
  ].join(" ");

  return generateNvidiaProductImage(prompt);
}
