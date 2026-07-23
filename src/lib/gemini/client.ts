import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { safeParseJSON } from "@/lib/gemini/safe-parse-json";
import { serverEnv } from "@/lib/env";

const ANTHROPIC_MODEL = "claude-haiku-4-5";

export const ANTHROPIC_AUTH_ERROR_MESSAGE =
  "Anthropic API key is invalid. Update ANTHROPIC_API_KEY in your environment.";

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderError";
  }
}

function isAnthropicAuthFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    status?: number;
    statusCode?: number;
    message?: string;
    error?: { type?: string; message?: string };
  };
  if (e.status === 401 || e.statusCode === 401) return true;
  if (e.error?.type === "authentication_error") return true;
  const message = `${e.message ?? ""} ${e.error?.message ?? ""}`;
  return /authentication_error|API key is invalid/i.test(message);
}

/** True when the failure is a bad/missing Anthropic key — callers must not retry. */
export function isAiAuthError(error: unknown): boolean {
  if (error instanceof AiProviderError) {
    return (
      error.message === ANTHROPIC_AUTH_ERROR_MESSAGE ||
      /API key is invalid|ANTHROPIC_API_KEY is not configured/i.test(error.message)
    );
  }
  return isAnthropicAuthFailure(error);
}

function getClient(): Anthropic {
  const apiKey = serverEnv.anthropicApiKey().trim();
  if (!apiKey) {
    throw new AiProviderError("ANTHROPIC_API_KEY is not configured.");
  }
  return new Anthropic({ apiKey });
}

function extractTextContent(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

function parseJsonResponse<T>(text: string): T {
  try {
    return safeParseJSON<T>(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Anthropic response was not valid JSON.";
    throw new AiProviderError(message);
  }
}

function toAiProviderError(error: unknown, fallback: string): AiProviderError {
  if (error instanceof AiProviderError) return error;
  if (isAnthropicAuthFailure(error)) {
    return new AiProviderError(ANTHROPIC_AUTH_ERROR_MESSAGE);
  }
  const message = error instanceof Error ? error.message : fallback;
  return new AiProviderError(message);
}

export interface GenerateAiJsonOptions {
  maxTokens?: number;
}

export async function generateAiJson<T>(
  prompt: string,
  options?: GenerateAiJsonOptions,
): Promise<T> {
  const client = getClient();
  const maxTokens = options?.maxTokens ?? 1024;

  try {
    const message = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });

    const text = extractTextContent(message.content);
    if (!text) {
      throw new AiProviderError("Anthropic returned an empty response.");
    }

    return parseJsonResponse<T>(text);
  } catch (error) {
    throw toAiProviderError(error, "Anthropic request failed.");
  }
}

function normalizeImageUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return trimmed;
}

async function buildImageSource(
  url: string,
): Promise<Anthropic.Messages.ImageBlockParam> {
  const normalized = normalizeImageUrl(url);

  try {
    const response = await fetch(normalized, { cache: "no-store" });
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      const mediaType = contentType.split(";")[0].trim() as
        | "image/jpeg"
        | "image/png"
        | "image/gif"
        | "image/webp";
      if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mediaType)) {
        return {
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType,
            data: buffer.toString("base64"),
          },
        };
      }
    }
  } catch {
    // Fall through to URL source.
  }

  return {
    type: "image",
    source: {
      type: "url",
      url: normalized,
    },
  };
}

export async function generateAiVisionJson<T>(
  imageUrls: string[],
  promptText: string,
): Promise<T> {
  const client = getClient();
  const images = imageUrls.slice(0, 3);

  if (images.length === 0) {
    throw new AiProviderError("At least one image URL is required for vision check.");
  }

  const imageBlocks = await Promise.all(images.map((url) => buildImageSource(url)));

  try {
    const message = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [...imageBlocks, { type: "text", text: promptText }],
        },
      ],
    });

    const text = extractTextContent(message.content);
    if (!text) {
      throw new AiProviderError("Anthropic vision returned an empty response.");
    }

    return parseJsonResponse<T>(text);
  } catch (error) {
    throw toAiProviderError(error, "Anthropic vision request failed.");
  }
}
