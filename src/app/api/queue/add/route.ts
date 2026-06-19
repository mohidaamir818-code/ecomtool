import { NextRequest, NextResponse } from "next/server";
import { addToQueue } from "@/lib/quota/queue-service";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type { QueuePlatform } from "@/types/quota";

const PLATFORMS: QueuePlatform[] = ["ebay", "aliexpress"];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      platform?: QueuePlatform;
      itemIds?: string[];
      scheduledFor?: string;
    };

    if (!body.userId?.trim()) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!body.platform || !PLATFORMS.includes(body.platform)) {
      return NextResponse.json({ error: "Valid platform is required." }, { status: 400 });
    }

    if (!body.itemIds?.length) {
      return NextResponse.json({ error: "itemIds are required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(body.userId);
    if (accessDenied) return accessDenied;

    const queue = await addToQueue(
      body.userId,
      body.platform,
      body.itemIds,
      body.scheduledFor,
    );

    return NextResponse.json({ success: true, queue }, { status: 201 });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to add to queue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
