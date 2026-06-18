import type { NextRequest } from "next/server";
import { getAllowedIps } from "@/lib/admin/config";

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "";
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "127.0.0.1";
}

export function isIpAllowed(request: NextRequest): boolean {
  const allowed = getAllowedIps();
  if (allowed.length === 0) return false;

  const clientIp = getClientIp(request);
  return allowed.includes(clientIp);
}
