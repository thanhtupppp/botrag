"use client";

import { useState } from "react";
import type { ChatSessionRow } from "@/lib/chat/sessions";

type Props = {
  sessions: ChatSessionRow[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => Promise<void>;
};

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function ChatSessionsPanel({
  sessions,
  activeSessionId,
  onSelectSession,
  onRenameSession,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  function startRename(session: ChatSessionRow) {
    setEditingId(session.id);
    setDraftTitle(session.title || "Untitled session");
  }

  async function submitRename(sessionId: string) {
    const nextTitle = draftTitle.trim();
    if (!nextTitle) return;
    setSavingId(sessionId);
    try {
      await onRenameSession(sessionId, nextTitle);
      setEditingId(null);
      setDraftTitle("");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm uppercase tracking-[0.3em] text-white/50">
          Sessions
        </p>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-white/45">
          {sessions.length}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {sessions.length ? (
          sessions.map((session) => {
            const isActive = activeSessionId === session.id;
            const isEditing = editingId === session.id;

            return (
              <div
                key={session.id}
                className={`rounded-2xl border p-4 transition ${
                  isActive
                    ? "border-violet-400/40 bg-violet-500/10 shadow-[0_0_0_1px_rgba(168,85,247,0.15)]"
                    : "border-white/10 bg-black/20 hover:border-violet-400/40 hover:bg-white/5"
                }`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      autoFocus
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void submitRename(session.id);
                        }
                        if (e.key === "Escape") {
                          setEditingId(null);
                          setDraftTitle("");
                        }
                      }}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-violet-500/60"
                      placeholder="Session title"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void submitRename(session.id)}
                        disabled={savingId === session.id}
                        className="rounded-full bg-violet-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingId === session.id ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setDraftTitle("");
                        }}
                        className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/70 transition hover:bg-white/5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onSelectSession(session.id)}
                      className="block w-full text-left"
                    >
                      <p className="truncate font-medium text-white">
                        {session.title || "Untitled session"}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        {formatRelativeTime(session.created_at)}
                      </p>
                    </button>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                        {isActive ? "Active" : "History"}
                      </span>
                      <button
                        type="button"
                        onClick={() => startRename(session)}
                        className="text-xs text-violet-300 transition hover:text-violet-200"
                      >
                        Rename
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-sm text-white/50">No sessions yet.</p>
        )}
      </div>
    </section>
  );
}
