import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env";
import { safeParseJSON } from "@/lib/gemini/safe-parse-json";

const ANTHROPIC_MODEL = "claude-haiku-4-5";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

interface PhotoKeywordResult {
  keywords: string;
  title: string;
}

function getClient(): Anthropic {
  const apiKey = serverEnv.anthropicApiKey();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  return new Anthropic({ apiKey });
}

function parseDataUrl(input: string): { mediaType: string; data: string } | null {
  const match = input.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/i);
  if (!match) return null;
  return { mediaType: match[1].toLowerCase(), data: match[2] };
}

function detectMediaType(buffer: Buffer): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "image/gif";
  return "image/webp";
}

/**
 * Turn an uploaded product photo into AliExpress search keywords using vision AI.
 * Keeps this logic separate from the Dropship product-fetch client.
 */
export async function extractSupplierKeywordsFromPhoto(input: {
  imageBase64?: string;
  imageDataUrl?: string;
}): Promise<PhotoKeywordResult> {
  let mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" = "image/jpeg";
  let base64Data = "";

  if (input.imageDataUrl?.trim()) {
    const parsed = parseDataUrl(input.imageDataUrl.trim());
    if (!parsed) {
      throw new Error("Invalid image upload. Please use a JPG, PNG, or WebP photo.");
    }
    mediaType = parsed.mediaType as typeof mediaType;
    base64Data = parsed.data;
  } else if (input.imageBase64?.trim()) {
    base64Data = input.imageBase64.trim();
  } else {
    throw new Error("Please upload a product photo.");
  }

  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length === 0) {
    throw new Error("Could not read the uploaded photo.");
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Photo is too large. Please use an image under 4 MB.");
  }

  if (!input.imageDataUrl) {
    mediaType = detectMediaType(buffer);
  }

  const client = getClient();
  const message = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: "text",
            text: `Look at this product photo. Return ONLY valid JSON:
{
  "title": "short product title in English",
  "keywords": "3-8 AliExpress search keywords, comma-separated, most specific first"
}

Focus on what the product IS (type, material, color, key features). No brand names unless clearly visible.`,
          },
        ],
      },
    ],
  });

  const text = message.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!text) {
    throw new Error("Could not understand the uploaded photo.");
  }

  const parsed = safeParseJSON<Partial<PhotoKeywordResult>>(text);
  const keywords = typeof parsed.keywords === "string" ? parsed.keywords.trim() : "";
  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";

  if (keywords.length < 2 && title.length < 2) {
    throw new Error("Could not extract search keywords from this photo. Try another image.");
  }

  return {
    keywords: keywords || title,
    title: title || keywords,
  };
}
