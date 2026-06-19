import "server-only";

import { serverEnv } from "@/lib/env";

const GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export class GeminiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiError";
  }
}

function getApiKey(): string {
  const key = serverEnv.geminiApiKey();
  if (!key) {
    throw new GeminiError("GEMINI_API_KEY is not configured.");
  }
  return key;
}

export async function generateGeminiJson<T>(prompt: string): Promise<T> {
  const apiKey = getApiKey();
  const url = `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new GeminiError(data.error?.message ?? "Gemini request failed.");
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new GeminiError("Gemini returned an empty response.");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new GeminiError("Gemini response was not valid JSON.");
    }
    return JSON.parse(jsonMatch[0]) as T;
  }
}
