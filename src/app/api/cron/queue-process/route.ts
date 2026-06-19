import { NextRequest, NextResponse } from "next/server";
import { processDueCompetitorWatchUpdates } from "@/lib/competitors/service";
import { processDueHandlingUpdates } from "@/lib/handling/service";
import { processDueQueueItems } from "@/lib/quota/queue-service";

function verifyCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

export async function POST(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const [queueProcessed, watchesProcessed, handlingProcessed] = await Promise.all([
      processDueQueueItems(),
      processDueCompetitorWatchUpdates(),
      processDueHandlingUpdates(),
    ]);

    return NextResponse.json({
      success: true,
      queueProcessed,
      watchesProcessed,
      handlingProcessed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process queue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
