import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env";
import { safeParseJSON } from "@/lib/gemini/safe-parse-json";

const ANTHROPIC_MODEL = "claude-haiku-4-5";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export interface PhotoKeywordResult {
  /** Short phrase sent to the Affiliate API (2–4 words). */
  keywords: string;
  /** Human-readable product name shown in the UI. */
  title: string;
  /** Extra search phrases to try when the primary query returns nothing. */
  fallbackQueries: string[];
}

interface AiPhotoParseResult {
  title?: string;
  primarySearch?: string;
  alternateSearches?: string[] | string;
  keywords?: string;
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

function cleanPhrase(input: string): string {
  return input.replace(/[,;|]+/g, " ").replace(/\s+/g, " ").trim();
}

function buildSearchPlan(input: AiPhotoParseResult): PhotoKeywordResult {
  const title = cleanPhrase(typeof input.title === "string" ? input.title : "");
  const primarySearch = cleanPhrase(
    typeof input.primarySearch === "string"
      ? input.primarySearch
      : typeof input.keywords === "string"
        ? input.keywords.split(/[,;|]+/)[0] ?? input.keywords
        : "",
  );

  const alternatesRaw = input.alternateSearches;
  const alternates = Array.isArray(alternatesRaw)
    ? alternatesRaw
    : typeof alternatesRaw === "string"
      ? alternatesRaw.split(/[,;|]+/)
      : typeof input.keywords === "string"
        ? input.keywords.split(/[,;|]+/)
        : [];

  const fallbackSet = new Set<string>();
  for (const phrase of alternates) {
    const cleaned = cleanPhrase(String(phrase));
    if (cleaned.length >= 2) fallbackSet.add(cleaned);
  }

  const titleWords = title.split(/\s+/).filter(Boolean);
  if (titleWords.length > 3) fallbackSet.add(titleWords.slice(0, 3).join(" "));
  if (titleWords.length > 2) fallbackSet.add(titleWords.slice(-2).join(" "));

  let keywords = primarySearch;
  if (keywords.split(/\s+/).length > 4) {
    keywords = keywords.split(/\s+/).slice(0, 4).join(" ");
  }
  if (keywords.length < 2 && title.length >= 2) {
    keywords = titleWords.slice(0, 3).join(" ") || title.slice(0, 40);
  }

  fallbackSet.delete(keywords);
  const fallbackQueries = [...fallbackSet]
    .map((phrase) => (phrase.split(/\s+/).length > 4 ? phrase.split(/\s+/).slice(0, 4).join(" ") : phrase))
    .filter((phrase) => phrase.length >= 2 && phrase !== keywords)
    .slice(0, 5);

  if (keywords.length < 2 && title.length < 2) {
    throw new Error("Could not extract search keywords from this photo. Try another image.");
  }

  return {
    keywords,
    title: title || keywords,
    fallbackQueries,
  };
}

function detectMediaType(buffer: Buffer): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "image/gif";
  return "image/webp";
}

/**
 * Turn an uploaded product photo into short AliExpress Affiliate search terms.
 * Uses a broad 2–4 word phrase (not the full marketing title) so the API returns matches.
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
    max_tokens: 500,
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
  "title": "descriptive product name for display",
  "primarySearch": "2-4 word AliExpress search phrase — generic product type only, e.g. whitening toothpaste",
  "alternateSearches": ["broader phrase 1", "broader phrase 2", "category keyword"]
}

Rules:
- primarySearch must be SHORT (2-4 words) like what a buyer would type on AliExpress.
- Do NOT copy the full marketing title into primarySearch.
- alternateSearches should be broader/shorter fallbacks.
- Focus on product TYPE (toothpaste, earbuds, phone case), material, and main feature.`,
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

  return buildSearchPlan(safeParseJSON<AiPhotoParseResult>(text));
}
