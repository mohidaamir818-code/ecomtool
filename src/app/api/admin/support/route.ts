import { NextRequest, NextResponse } from "next/server";
import { adminApiNotFound, requireAdminApi } from "@/lib/admin/require-admin-api";
import {
  addMessage,
  getAllTickets,
  getTicketOwner,
  setTicketStatus,
} from "@/lib/support/service";
import type { SupportTicketStatus } from "@/types/support";

export const dynamic = "force-dynamic";

const STATUS_VALUES: SupportTicketStatus[] = ["open", "answered", "closed"];

export async function GET(request: NextRequest) {
  const denied = requireAdminApi(request);
  if (denied) return denied;

  try {
    const tickets = await getAllTickets();
    return NextResponse.json({ success: true, tickets });
  } catch {
    return adminApiNotFound();
  }
}

export async function POST(request: NextRequest) {
  const denied = requireAdminApi(request);
  if (denied) return denied;

  try {
    const form = await request.formData();
    const ticketId = String(form.get("ticketId") ?? "").trim();
    const body = String(form.get("message") ?? "");
    const statusRaw = String(form.get("status") ?? "").trim();
    const files = form.getAll("files").filter((item): item is File => item instanceof File);

    if (!ticketId) {
      return NextResponse.json({ error: "ticketId is required." }, { status: 400 });
    }

    const owner = await getTicketOwner(ticketId);
    if (!owner) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    }

    if (statusRaw && STATUS_VALUES.includes(statusRaw as SupportTicketStatus)) {
      await setTicketStatus(ticketId, statusRaw as SupportTicketStatus);
    }

    if (body.trim() || files.length > 0) {
      await addMessage({ ticketId, sender: "admin", body, files });
    }

    const tickets = await getAllTickets();
    return NextResponse.json({ success: true, tickets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send reply.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
