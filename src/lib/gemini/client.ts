import "server-only";

import { serverEnv } from "@/lib/env";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "meta-llama/llama-3.1-8b-instruct:free";

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderError";
  }
}

function getApiKey(): string {
  const key = serverEnv.openRouterApiKey();
  if (!key) {
    throw new AiProviderError("OPENROUTER_API_KEY is not configured.");
  }
  return key;
}

export async function generateAiJson<T>(prompt: string): Promise<T> {
  const apiKey = getApiKey();

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new AiProviderError(data.error?.message ?? "OpenRouter request failed.");
  }

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new AiProviderError("OpenRouter returned an empty response.");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new AiProviderError("OpenRouter response was not valid JSON.");
    }
    return JSON.parse(jsonMatch[0]) as T;
  }
}
