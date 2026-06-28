"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupportAttachment, SupportTicket } from "@/types/support";

const STATUS_LABEL: Record<SupportTicket["status"], string> = {
  open: "Awaiting reply",
  answered: "Answered",
  closed: "Closed",
};

const STATUS_STYLE: Record<SupportTicket["status"], string> = {
  open: "bg-amber-100 text-amber-700",
  answered: "bg-emerald-100 text-emerald-700",
  closed: "bg-gray-100 text-gray-500",
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
          className="h-28 w-28 rounded-lg border border-gray-200 object-cover"
        />
      </a>
    );
  }
  if (attachment.kind === "video") {
    return (
      <video
        src={attachment.url}
        controls
        className="h-40 w-56 rounded-lg border border-gray-200 bg-black object-contain"
      />
    );
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-brand hover:bg-gray-50"
    >
      📎 {attachment.name}
    </a>
  );
}

export function SupportCenter() {
  const [userId, setUserId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replying, setReplying] = useState(false);

  const newFileInputRef = useRef<HTMLInputElement | null>(null);
  const replyFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const id =
      sessionStorage.getItem("ecomtools_user_id") ||
      localStorage.getItem("ecomtools_user_id");
    setUserId(id);
  }, []);

  const loadTickets = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await fetch(`/api/support?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Failed to load messages.");
      setTickets(data.tickets ?? []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load messages.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      void loadTickets();
    } else {
      setLoading(false);
    }
  }, [userId, loadTickets]);

  const activeTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === activeTicketId) ?? null,
    [tickets, activeTicketId],
  );

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!userId) return;
    if (!message.trim() && files.length === 0) {
      setError("Add a message or attach a file.");
      return;
    }

    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("userId", userId);
      form.append("subject", subject);
      form.append("message", message);
      files.forEach((file) => form.append("files", file));

      const response = await fetch("/api/support", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Failed to send your message.");

      setTickets(data.tickets ?? []);
      setSubject("");
      setMessage("");
      setFiles([]);
      if (newFileInputRef.current) newFileInputRef.current.value = "";
      setShowNew(false);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to send your message.");
    } finally {
      setSending(false);
    }
  }

  async function handleReply(event: React.FormEvent) {
    event.preventDefault();
    if (!userId || !activeTicketId) return;
    if (!replyText.trim() && replyFiles.length === 0) return;

    setReplying(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("userId", userId);
      form.append("ticketId", activeTicketId);
      form.append("message", replyText);
      replyFiles.forEach((file) => form.append("files", file));

      const response = await fetch("/api/support", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Failed to send your message.");

      setTickets(data.tickets ?? []);
      setReplyText("");
      setReplyFiles([]);
      if (replyFileInputRef.current) replyFileInputRef.current.value = "";
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "Failed to send your message.");
    } finally {
      setReplying(false);
    }
  }

  if (!userId && !loading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-[#6B7280] shadow-sm">
        Please sign in to contact support.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#111827]">Your conversations</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            Send a message with screenshots or a short video and our team will reply here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowNew((value) => !value);
            setActiveTicketId(null);
          }}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
        >
          {showNew ? "Cancel" : "New message"}
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {showNew ? (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
        >
          <label className="block text-sm">
            <span className="font-medium text-[#111827]">Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g. Listing not syncing"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#111827]">Message</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              placeholder="Describe your issue..."
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#111827]">Photos / videos</span>
            <input
              ref={newFileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              className="mt-1 block w-full text-sm text-[#6B7280] file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand"
            />
            {files.length > 0 ? (
              <span className="mt-1 block text-xs text-[#6B7280]">{files.length} file(s) selected</span>
            ) : null}
          </label>
          <button
            type="submit"
            disabled={sending}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send message"}
          </button>
        </form>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-[#6B7280] shadow-sm">
          Loading your messages...
        </div>
      ) : tickets.length === 0 && !showNew ? (
        <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-[#6B7280] shadow-sm">
          You have no support messages yet. Click <span className="font-semibold">New message</span> to
          start a conversation.
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const isOpen = ticket.id === activeTicketId;
            return (
              <div
                key={ticket.id}
                className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setActiveTicketId(isOpen ? null : ticket.id)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#111827]">{ticket.subject}</p>
                    <p className="mt-0.5 text-xs text-[#9CA3AF]">
                      Updated {formatTime(ticket.lastMessageAt)} · {ticket.messages.length} message(s)
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[ticket.status]}`}
                  >
                    {STATUS_LABEL[ticket.status]}
                  </span>
                </button>

                {isOpen ? (
                  <div className="border-t border-gray-100 px-5 py-4">
                    <div className="space-y-4">
                      {ticket.messages.map((msg) => {
                        const mine = msg.sender === "user";
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                                mine
                                  ? "bg-brand text-white"
                                  : "bg-gray-100 text-[#111827]"
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
                            <span className="mt-1 text-[10px] text-[#9CA3AF]">
                              {mine ? "You" : "Support"} · {formatTime(msg.createdAt)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <form onSubmit={handleReply} className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                      <textarea
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        rows={2}
                        placeholder="Write a reply..."
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          ref={replyFileInputRef}
                          type="file"
                          accept="image/*,video/*"
                          multiple
                          onChange={(event) => setReplyFiles(Array.from(event.target.files ?? []))}
                          className="text-xs text-[#6B7280] file:mr-2 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand"
                        />
                        <button
                          type="submit"
                          disabled={replying}
                          className="ml-auto rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
                        >
                          {replying ? "Sending..." : "Reply"}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
