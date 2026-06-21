function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
  cleaned = cleaned.replace(/\s*```\s*$/i, "");
  return cleaned.trim();
}

function removeTrailingCommas(text: string): string {
  return text.replace(/,(\s*[}\]])/g, "$1");
}

export function safeParseJSON<T>(text: string): T {
  let cleaned = stripMarkdownFences(text);

  const attempts = [
    () => JSON.parse(cleaned) as T,
    () => JSON.parse(removeTrailingCommas(cleaned)) as T,
    () => {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON object found in response.");
      }
      return JSON.parse(jsonMatch[0]) as T;
    },
    () => {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON object found in response.");
      }
      return JSON.parse(removeTrailingCommas(jsonMatch[0])) as T;
    },
  ];

  for (const attempt of attempts) {
    try {
      return attempt();
    } catch {
      // Try next recovery strategy.
    }
  }

  const snippet = cleaned.slice(0, 200);
  throw new Error(
    `AI returned invalid JSON: ${snippet}${cleaned.length > 200 ? "..." : ""}`,
  );
}
