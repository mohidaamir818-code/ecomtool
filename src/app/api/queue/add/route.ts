import { NextRequest, NextResponse } from "next/server";
import { addToQueue } from "@/lib/quota/queue-service";
import { getSupabaseAdmin } from "@/lib/supabase/server";
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

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", body.userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const queue = await addToQueue(
      body.userId,
      body.platform,
      body.itemIds,
      body.scheduledFor,
    );

    return NextResponse.json({ success: true, queue }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add to queue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
