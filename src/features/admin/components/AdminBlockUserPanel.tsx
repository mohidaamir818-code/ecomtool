"use client";

import { useState } from "react";

interface AdminBlockUserPanelProps {
  userId: string;
  isBlocked: boolean;
  blockedReason: string | null;
  onUpdated: () => void;
}

export function AdminBlockUserPanel({
  userId,
  isBlocked,
  blockedReason,
  onUpdated,
}: AdminBlockUserPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleBlock() {
    if (reason.trim().length < 3) {
      setMessage("Please enter a block reason (at least 3 characters).");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/users/${userId}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      if (!response.ok) {
        setMessage("Failed to block user.");
        return;
      }

      setShowForm(false);
      setReason("");
      setMessage("User has been blocked.");
      onUpdated();
    } catch {
      setMessage("Network error while blocking user.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnblock() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/users/${userId}/unblock`, {
        method: "POST",
      });

      if (!response.ok) {
        setMessage("Failed to unblock user.");
        return;
      }

      setMessage("User has been unblocked.");
      onUpdated();
    } catch {
      setMessage("Network error while unblocking user.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Account access</h2>
          <p className="mt-1 text-sm text-white/60">
            Block this seller from using the platform. They will see your reason on their dashboard.
          </p>
        </div>

        {isBlocked ? (
          <span className="inline-flex rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300">
            Blocked
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
            Active
          </span>
        )}
      </div>

      {isBlocked && blockedReason ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <p className="font-medium">Current block reason</p>
          <p className="mt-1 text-red-100/90">{blockedReason}</p>
        </div>
      ) : null}

      {showForm && !isBlocked ? (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <label className="block text-sm font-medium text-white">
            Reason for blocking
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Explain why this account is being blocked..."
              className="mt-2 w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleBlock()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {loading ? "Blocking..." : "Confirm block"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setShowForm(false);
                setReason("");
              }}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {!isBlocked ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-red-600/90 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
            >
              Block user
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleUnblock()}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60"
            >
              {loading ? "Unblocking..." : "Unblock user"}
            </button>
          )}
        </div>
      )}

      {message ? <p className="text-sm text-white/70">{message}</p> : null}
    </div>
  );
}
