import "server-only";

import { serverEnv } from "@/lib/env";

const NVIDIA_FLUX_URL =
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

  const images = data.images;
  if (Array.isArray(images) && typeof images[0] === "string") {
    return images[0].replace(/^data:image\/\w+;base64,/, "");
  }

  return null;
}

/**
 * Text → image via NVIDIA FLUX.2-klein-4b (fast). Runs in parallel with listing AI.
 */
export async function generateNvidiaProductImage(prompt: string): Promise<NvidiaImageResult> {
  const apiKey = serverEnv.nvidiaApiKey();
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not configured.");
  }

  const response = await fetch(NVIDIA_FLUX_URL, {
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
