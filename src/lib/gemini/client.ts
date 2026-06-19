import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env";

const ANTHROPIC_MODEL = "claude-haiku-4-5";

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderError";
  }
}

function getClient(): Anthropic {
  const apiKey = serverEnv.anthropicApiKey();
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
    return JSON.parse(text) as T;
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new AiProviderError("Anthropic response was not valid JSON.");
    }
    return JSON.parse(jsonMatch[0]) as T;
  }
}

export async function generateAiJson<T>(prompt: string): Promise<T> {
  const client = getClient();

  try {
    const message = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = extractTextContent(message.content);
    if (!text) {
      throw new AiProviderError("Anthropic returned an empty response.");
    }

    return parseJsonResponse<T>(text);
  } catch (error) {
    if (error instanceof AiProviderError) throw error;

    const message =
      error instanceof Error ? error.message : "Anthropic request failed.";
    throw new AiProviderError(message);
  }
}
