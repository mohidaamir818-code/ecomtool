import { NextRequest, NextResponse } from "next/server";
import {
  addMessage,
  createTicketWithMessage,
  getTicketOwner,
  getUserTickets,
} from "@/lib/support/service";
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

    const tickets = await getUserTickets(userId);
    return NextResponse.json({ success: true, tickets });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;
    const message = error instanceof Error ? error.message : "Failed to load support messages.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const userId = String(form.get("userId") ?? "").trim();
    const ticketId = String(form.get("ticketId") ?? "").trim();
    const subject = String(form.get("subject") ?? "").trim();
    const body = String(form.get("message") ?? "");
    const files = form.getAll("files").filter((item): item is File => item instanceof File);

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    if (ticketId) {
      const owner = await getTicketOwner(ticketId);
      if (owner !== userId) {
        return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
      }
      await addMessage({ ticketId, sender: "user", body, files });
    } else {
      await createTicketWithMessage({ userId, subject, body, files });
    }

    const tickets = await getUserTickets(userId);
    return NextResponse.json({ success: true, tickets }, { status: 201 });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;
    const message = error instanceof Error ? error.message : "Failed to send your message.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
