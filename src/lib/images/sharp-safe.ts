import "server-only";

type SharpModule = typeof import("sharp");
type SharpFn = SharpModule["default"];

let cached: SharpFn | null | undefined;

/**
 * Lazily load sharp. Returns null when the native binary cannot load
 * (common on mismatched OS builds / missing libvips on serverless).
 * Callers must fail soft — never let a missing sharp crash product/VeRO flows.
 */
export async function getSharp(): Promise<SharpFn | null> {
  if (cached !== undefined) return cached;

  try {
    const mod = await import("sharp");
    cached = mod.default;
    return cached;
  } catch (error) {
    console.warn(
      "[sharp] native module unavailable; continuing without image processing:",
      error instanceof Error ? error.message : error,
    );
    cached = null;
    return null;
  }
}
