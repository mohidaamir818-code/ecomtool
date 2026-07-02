import type { VeroCheckResult } from "@/types/listing-generator";

export const VERO_HOLD_PREFIX = "__VERO_HOLD__:";

export function serializeVeroHoldMessage(
  vero: Pick<VeroCheckResult, "summary" | "warnings">,
): string {
  return (
    VERO_HOLD_PREFIX +
    JSON.stringify({ summary: vero.summary, warnings: vero.warnings ?? [] })
  );
}

export function parseVeroHoldMessage(
  message: string | null,
): { summary: string; warnings: string[] } | null {
  if (!message) return null;
  if (message.startsWith(VERO_HOLD_PREFIX)) {
    try {
      const parsed = JSON.parse(message.slice(VERO_HOLD_PREFIX.length)) as {
        summary?: string;
        warnings?: string[];
      };
      return { summary: parsed.summary ?? "", warnings: parsed.warnings ?? [] };
    } catch {
      return null;
    }
  }
  return { summary: message, warnings: [] };
}

export class VeroAckRequiredError extends Error {
  readonly veroResult: VeroCheckResult;

  constructor(veroResult: VeroCheckResult) {
    super("VERO_ACK_REQUIRED");
    this.name = "VeroAckRequiredError";
    this.veroResult = veroResult;
  }
}

export function isVeroAckRequiredError(error: unknown): error is VeroAckRequiredError {
  return error instanceof VeroAckRequiredError;
}
