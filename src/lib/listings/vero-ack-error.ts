export class VeroAckRequiredError extends Error {
  readonly veroSummary: string;

  constructor(veroSummary: string) {
    super("VERO_ACK_REQUIRED");
    this.name = "VeroAckRequiredError";
    this.veroSummary = veroSummary;
  }
}

export function isVeroAckRequiredError(error: unknown): error is VeroAckRequiredError {
  return error instanceof VeroAckRequiredError;
}
