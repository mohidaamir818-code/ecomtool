import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  AdminSupportTicket,
  SupportAttachment,
  SupportAttachmentKind,
  SupportMessage,
  SupportSender,
  SupportTicket,
  SupportTicketStatus,
} from "@/types/support";

const BUCKET = "support-attachments";
const MAX_FILES = 6;
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB per file (covers short videos).

function resolveKind(mimeType: string): SupportAttachmentKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  return cleaned || "file";
}

/**
 * Uploads incoming files to the public support-attachments bucket and returns
 * the stored attachment metadata (public URL + kind for rendering).
 */
export async function uploadSupportAttachments(
  ticketId: string,
  sender: SupportSender,
  files: File[],
): Promise<SupportAttachment[]> {
  if (!files.length) return [];

  const supabase = getSupabaseAdmin();
  const usable = files.filter((file) => file && file.size > 0).slice(0, MAX_FILES);
  const attachments: SupportAttachment[] = [];

  for (const file of usable) {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`"${file.name}" is larger than the 50MB limit.`);
    }

    const arrayBuffer = await file.arrayBuffer();
    const safeName = sanitizeFileName(file.name);
    const path = `${ticketId}/${sender}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    const contentType = file.type || "application/octet-stream";

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType, upsert: false });

    if (error) {
      if (error.message.toLowerCase().includes("bucket not found")) {
        throw new Error(
          "Storage bucket missing. Run supabase/migrations/024_support_tickets.sql in Supabase.",
        );
      }
      throw new Error(error.message);
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    attachments.push({
      url: data.publicUrl,
      name: file.name,
      type: contentType,
      kind: resolveKind(contentType),
    });
  }

  return attachments;
}

function mapMessage(row: Record<string, unknown>): SupportMessage {
  return {
    id: String(row.id),
    ticketId: String(row.ticket_id),
    sender: String(row.sender) as SupportSender,
    body: String(row.body ?? ""),
    attachments: (row.attachments as SupportAttachment[] | null) ?? [],
    createdAt: String(row.created_at),
  };
}

function mapTicket(row: Record<string, unknown>, messages: SupportMessage[]): SupportTicket {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    subject: String(row.subject ?? "Support request"),
    status: String(row.status ?? "open") as SupportTicketStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastMessageAt: String(row.last_message_at ?? row.created_at),
    messages,
  };
}

async function loadMessagesByTicketIds(
  ticketIds: string[],
): Promise<Map<string, SupportMessage[]>> {
  const byTicket = new Map<string, SupportMessage[]>();
  if (ticketIds.length === 0) return byTicket;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("support_messages")
    .select("*")
    .in("ticket_id", ticketIds)
    .order("created_at", { ascending: true });

  for (const row of data ?? []) {
    const message = mapMessage(row as Record<string, unknown>);
    const list = byTicket.get(message.ticketId) ?? [];
    list.push(message);
    byTicket.set(message.ticketId, list);
  }

  return byTicket;
}

export async function getUserTickets(userId: string): Promise<SupportTicket[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false });

  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(error.message);
  }

  const rows = data ?? [];
  const messagesByTicket = await loadMessagesByTicketIds(rows.map((row) => String(row.id)));

  return rows.map((row) =>
    mapTicket(row as Record<string, unknown>, messagesByTicket.get(String(row.id)) ?? []),
  );
}

async function touchTicket(
  ticketId: string,
  status: SupportTicketStatus,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("support_tickets")
    .update({
      status,
      updated_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    })
    .eq("id", ticketId);
}

export async function createTicketWithMessage(input: {
  userId: string;
  subject: string;
  body: string;
  files: File[];
}): Promise<SupportTicket> {
  const supabase = getSupabaseAdmin();

  const { data: ticketRow, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({
      user_id: input.userId,
      subject: input.subject.trim() || "Support request",
      status: "open",
    })
    .select()
    .single();

  if (ticketError) {
    if (ticketError.message.includes("does not exist")) {
      throw new Error("Run supabase/migrations/024_support_tickets.sql in Supabase.");
    }
    throw new Error(ticketError.message);
  }

  const ticketId = String(ticketRow.id);
  await addMessage({ ticketId, sender: "user", body: input.body, files: input.files });

  const tickets = await getUserTickets(input.userId);
  return tickets.find((ticket) => ticket.id === ticketId) ?? mapTicket(ticketRow, []);
}

export async function addMessage(input: {
  ticketId: string;
  sender: SupportSender;
  body: string;
  files: File[];
}): Promise<SupportMessage> {
  const supabase = getSupabaseAdmin();
  const attachments = await uploadSupportAttachments(input.ticketId, input.sender, input.files);

  if (!input.body.trim() && attachments.length === 0) {
    throw new Error("Add a message or attach a file.");
  }

  const { data, error } = await supabase
    .from("support_messages")
    .insert({
      ticket_id: input.ticketId,
      sender: input.sender,
      body: input.body.trim(),
      attachments,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // A user reply re-opens the ticket; an admin reply marks it answered.
  await touchTicket(input.ticketId, input.sender === "admin" ? "answered" : "open");

  return mapMessage(data as Record<string, unknown>);
}

export async function getTicketOwner(ticketId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("support_tickets")
    .select("user_id")
    .eq("id", ticketId)
    .maybeSingle();
  return data?.user_id ? String(data.user_id) : null;
}

export async function getAllTickets(): Promise<AdminSupportTicket[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .order("last_message_at", { ascending: false });

  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(error.message);
  }

  const rows = data ?? [];
  const ticketIds = rows.map((row) => String(row.id));
  const userIds = [...new Set(rows.map((row) => String(row.user_id)))];
  const messagesByTicket = await loadMessagesByTicketIds(ticketIds);

  const profilesById = new Map<string, { email: string | null; name: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);
    for (const profile of profiles ?? []) {
      profilesById.set(String(profile.id), {
        email: profile.email ? String(profile.email) : null,
        name: profile.full_name ? String(profile.full_name) : null,
      });
    }
  }

  return rows.map((row) => {
    const base = mapTicket(
      row as Record<string, unknown>,
      messagesByTicket.get(String(row.id)) ?? [],
    );
    const profile = profilesById.get(base.userId);
    return {
      ...base,
      userEmail: profile?.email ?? null,
      userName: profile?.name ?? null,
    };
  });
}

export async function setTicketStatus(
  ticketId: string,
  status: SupportTicketStatus,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("support_tickets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", ticketId);
}
