import { NextRequest, NextResponse } from "next/server";
import {
  getAutoSyncSettings,
  normalizeAutoSyncSettings,
  saveAutoSyncSettings,
  type AutoSyncSettings,
} from "@/lib/listings/auto-sync-settings";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const settings = await getAutoSyncSettings(userId);
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;
    const message = error instanceof Error ? error.message : "Failed to load auto-sync settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      settings?: Partial<AutoSyncSettings>;
    };

    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    if (!body.settings || typeof body.settings !== "object") {
      return NextResponse.json({ error: "settings are required." }, { status: 400 });
    }

    const settings = await saveAutoSyncSettings(userId, normalizeAutoSyncSettings(body.settings));
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;
    const message = error instanceof Error ? error.message : "Failed to save auto-sync settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
