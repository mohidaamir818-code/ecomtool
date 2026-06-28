"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AdminSupportTicket, SupportAttachment, SupportTicketStatus } from "@/types/support";

const STATUS_STYLE: Record<SupportTicketStatus, string> = {
  open: "bg-amber-500/20 text-amber-300",
  answered: "bg-emerald-500/20 text-emerald-300",
  closed: "bg-white/10 text-white/50",
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function AttachmentView({ attachment }: { attachment: SupportAttachment }) {
  if (attachment.kind === "image") {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt={attachment.name}
          className="h-24 w-24 rounded-lg border border-white/10 object-cover"
        />
      </a>
    );
  }
  if (attachment.kind === "video") {
    return (
      <video
        src={attachment.url}
        controls
        className="h-36 w-52 rounded-lg border border-white/10 bg-black object-contain"
      />
    );
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-[#9b8bff] hover:bg-white/5"
    >
      📎 {attachment.name}
    </a>
  );
}

export function AdminSupportPanel() {
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  const [replyText, setReplyText] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadTickets = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/support");
      if (!response.ok) throw new Error("Failed to load support tickets.");
      const data = await response.json();
      setTickets(data.tickets ?? []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const activeTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === activeTicketId) ?? null,
    [tickets, activeTicketId],
  );

  const sendReply = useCallback(
    async (statusOverride?: SupportTicketStatus) => {
      if (!activeTicketId) return;
      setSending(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("ticketId", activeTicketId);
        form.append("message", replyText);
        if (statusOverride) form.append("status", statusOverride);
        replyFiles.forEach((file) => form.append("files", file));

        const response = await fetch("/api/admin/support", { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? "Failed to send reply.");

        setTickets(data.tickets ?? []);
        setReplyText("");
        setReplyFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (replyError) {
        setError(replyError instanceof Error ? replyError.message : "Failed to send reply.");
      } finally {
        setSending(false);
      }
    },
    [activeTicketId, replyText, replyFiles],
  );

  async function handleReply(event: React.FormEvent) {
    event.preventDefault();
    if (!replyText.trim() && replyFiles.length === 0) return;
    await sendReply();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Tickets</h2>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void loadTickets();
            }}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10"
          >
            Refresh
          </button>
        </div>

        {error ? <p className="mb-3 text-xs text-red-400">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-white/50">Loading...</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-white/50">No support messages yet.</p>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => {
              const active = ticket.id === activeTicketId;
              return (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setActiveTicketId(ticket.id)}
                  className={`block w-full rounded-xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-[#5842f4] bg-[#5842f4]/15"
                      : "border-white/10 bg-black/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-white">{ticket.subject}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[ticket.status]}`}
                    >
                      {ticket.status}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-white/50">
                    {ticket.userName || ticket.userEmail || ticket.userId}
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/30">
                    {formatTime(ticket.lastMessageAt)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
        {!activeTicket ? (
          <p className="text-sm text-white/50">Select a ticket to read and reply.</p>
        ) : (
          <div className="flex h-full flex-col">
            <div className="border-b border-white/10 pb-3">
              <h2 className="text-base font-bold text-white">{activeTicket.subject}</h2>
              <p className="mt-1 text-xs text-white/50">
                {activeTicket.userName || "Unknown"} ·{" "}
                {activeTicket.userEmail || activeTicket.userId}
              </p>
            </div>

            <div className="mt-4 max-h-[460px] flex-1 space-y-4 overflow-y-auto pr-1">
              {activeTicket.messages.map((msg) => {
                const fromAdmin = msg.sender === "admin";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${fromAdmin ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                        fromAdmin ? "bg-[#5842f4] text-white" : "bg-white/10 text-white/90"
                      }`}
                    >
                      {msg.body ? <p className="whitespace-pre-wrap">{msg.body}</p> : null}
                      {msg.attachments.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {msg.attachments.map((attachment, index) => (
                            <AttachmentView key={index} attachment={attachment} />
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <span className="mt-1 text-[10px] text-white/30">
                      {fromAdmin ? "You (Support)" : "User"} · {formatTime(msg.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleReply} className="mt-4 space-y-2 border-t border-white/10 pt-4">
              <textarea
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                rows={3}
                placeholder="Write your reply..."
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#5842f4] focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(event) => setReplyFiles(Array.from(event.target.files ?? []))}
                  className="text-xs text-white/60 file:mr-2 file:rounded-lg file:border-0 file:bg-[#5842f4]/20 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[#9b8bff]"
                />
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => void sendReply("closed")}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 disabled:opacity-60"
                  >
                    {sending ? "..." : "Reply & close"}
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="rounded-lg bg-[#5842f4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4a37d6] disabled:opacity-60"
                  >
                    {sending ? "Sending..." : "Send reply"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
