import "server-only";

import { serverEnv } from "@/lib/env";

const NVIDIA_EDIT_URL =
  process.env.NVIDIA_IMAGE_EDIT_API_URL?.trim() ||
  "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev";

const NVIDIA_FALLBACK_URL =
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

async function downloadImage(url: string): Promise<{ bytes: Buffer; contentType: string }> {
  const response = await fetch(url, {
    headers: { Accept: "image/*,*/*" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to download source photo (${response.status}).`);
  }
  const contentType = (response.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 100) throw new Error("Source photo was empty.");
  return { bytes, contentType: contentType.startsWith("image/") ? contentType : "image/jpeg" };
}

async function uploadNvcfAsset(
  apiKey: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  const auth = await fetch("https://api.nvcf.nvidia.com/v2/nvcf/assets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contentType, description: "listing-photo-edit" }),
    signal: AbortSignal.timeout(10_000),
  });
  const authJson = (await auth.json()) as { assetId?: string; uploadUrl?: string; detail?: string };
  if (!auth.ok || !authJson.assetId || !authJson.uploadUrl) {
    throw new Error(`NVIDIA asset create failed: ${JSON.stringify(authJson).slice(0, 200)}`);
  }

  const upload = await fetch(authJson.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-amz-meta-nvcf-asset-description": "listing-photo-edit",
    },
    body: new Uint8Array(bytes),
    signal: AbortSignal.timeout(20_000),
  });
  if (!upload.ok) {
    throw new Error(`NVIDIA asset upload failed (${upload.status}).`);
  }
  return authJson.assetId;
}

async function callKontextEdit(input: {
  apiKey: string;
  prompt: string;
  imageRef: string;
  assetId?: string;
}): Promise<NvidiaImageResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.apiKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (input.assetId) {
    headers["NVCF-INPUT-ASSET-REFERENCES"] = input.assetId;
  }

  const response = await fetch(NVIDIA_EDIT_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt: input.prompt.slice(0, 1200),
      image: input.imageRef,
      aspect_ratio: "1:1",
    }),
    signal: AbortSignal.timeout(25_000),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`NVIDIA edit failed (${response.status}): ${rawText.slice(0, 300)}`);
  }

  const json = JSON.parse(rawText) as unknown;
  const base64 = extractBase64(json);
  if (!base64) throw new Error("NVIDIA edit returned no image.");
  return { base64, mimeType: "image/jpeg" };
}

async function callKleinProductImage(prompt: string, apiKey: string): Promise<NvidiaImageResult> {
  const response = await fetch(NVIDIA_FALLBACK_URL, {
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
    signal: AbortSignal.timeout(20_000),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`NVIDIA fallback image failed (${response.status}): ${rawText.slice(0, 300)}`);
  }
  const json = JSON.parse(rawText) as unknown;
  const base64 = extractBase64(json);
  if (!base64) throw new Error("NVIDIA fallback returned no image.");
  return { base64, mimeType: "image/png" };
}

/**
 * Edit an AliExpress (or any) product photo with the seller's prompt via NVIDIA.
 * Tries Kontext (true image edit) first; falls back to fast Klein guided by title+prompt
 * if the NVIDIA account blocks custom image inputs.
 */
export async function editNvidiaListingPhoto(input: {
  imageUrl: string;
  sellerPrompt: string;
  productTitle: string;
}): Promise<NvidiaImageResult> {
  const apiKey = serverEnv.nvidiaApiKey();
  if (!apiKey) throw new Error("NVIDIA_API_KEY is not configured.");

  const editPrompt = [
    "Edit this exact product photo for an online marketplace listing.",
    "Keep the same product identity, shape, colours, and materials.",
    "Do not invent a different product.",
    `Seller instructions: ${input.sellerPrompt.trim()}`,
  ].join(" ");

  const { bytes, contentType } = await downloadImage(input.imageUrl);
  const ext = contentType.includes("png") ? "png" : "jpeg";

  // 1) Try Kontext with NVCF asset (preferred real edit path)
  try {
    const assetId = await uploadNvcfAsset(apiKey, bytes, contentType);
    return await callKontextEdit({
      apiKey,
      prompt: editPrompt,
      imageRef: `data:image/${ext};asset_id,${assetId}`,
      assetId,
    });
  } catch (assetError) {
    console.warn("[NVIDIA edit] asset/kontext path failed:", assetError);
  }

  // 2) Try Kontext with inline base64
  try {
    const dataUri = `data:${contentType};base64,${bytes.toString("base64")}`;
    return await callKontextEdit({
      apiKey,
      prompt: editPrompt,
      imageRef: dataUri,
    });
  } catch (base64Error) {
    console.warn("[NVIDIA edit] base64/kontext path failed:", base64Error);
  }

  // 3) Fast Klein fallback — keep product tied to title + seller edit instructions
  const fallbackPrompt = [
    "Professional ecommerce product photograph.",
    `Product: ${input.productTitle.slice(0, 180)}.`,
    `Apply these photo edits: ${input.sellerPrompt.trim()}.`,
    "Keep the same product. Clean listing style. No watermark. No text overlay.",
  ].join(" ");

  return callKleinProductImage(fallbackPrompt, apiKey);
}

/** @deprecated Prefer editNvidiaListingPhoto for listing prepare. */
export async function generateNvidiaProductImage(prompt: string): Promise<NvidiaImageResult> {
  const apiKey = serverEnv.nvidiaApiKey();
  if (!apiKey) throw new Error("NVIDIA_API_KEY is not configured.");
  return callKleinProductImage(prompt, apiKey);
}
