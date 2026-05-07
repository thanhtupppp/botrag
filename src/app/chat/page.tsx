"use client";

import { useEffect, useState } from "react";
import { ChatPanel, type ChatState } from "@/components/chat-panel";
import { Rag3DScene } from "@/components/rag-3d-scene";
import { ChatSessionsPanel } from "@/components/chat-sessions-panel";
import { Uploader } from "@/components/uploader";
import { UploadEmptyState } from "@/components/upload-empty-state";
import { UploadSkeleton } from "@/components/upload-skeleton";

type UiSession = {
  id: string;
  title: string | null;
  createdAt: string;
};

export default function ChatPage() {
  const [chatState, setChatState] = useState<ChatState>("idle");
  const [activeCitationCount, setActiveCitationCount] = useState(0);
  const [sessions, setSessions] = useState<UiSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [initialMessages, setInitialMessages] = useState<
    Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      createdAt: string;
    }>
  >([]);

  async function loadSessions() {
    setSessionsLoading(true);
    setSessionsError(null);

    try {
      const res = await fetch("/api/chat/sessions");
      if (res.status === 401) {
        setSessions([]);
        setSessionsError(null);
        return;
      }
      if (!res.ok) {
        console.error("Failed to load sessions", res.status);
        setSessionsError("Failed to load sessions");
        return;
      }

      const data = (await res.json()) as {
        sessions: Array<{
          id: string;
          title: string | null;
          createdAt: string;
        }>;
      };
      setSessions(
        data.sessions.map((session) => ({
          id: session.id,
          title: session.title,
          createdAt: session.createdAt,
        })),
      );
    } catch (error) {
      console.error("Failed to load sessions", error);
      setSessionsError("Failed to load sessions");
    } finally {
      setSessionsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAuthReady(true);
    }, 150);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    void loadSessions();
  }, [authReady]);

  async function loadSession(sessionId: string) {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`);
      if (!res.ok) {
        console.error("Failed to load session", res.status);
        return;
      }
      const data = (await res.json()) as {
        session: { id: string; title: string | null; createdAt: string };
        messages: Array<{
          id: string;
          role: "user" | "assistant";
          content: string;
          createdAt: string;
        }>;
      };
      setActiveSessionId(data.session.id);
      setInitialMessages(data.messages);
    } catch (error) {
      console.error("Failed to load session", error);
    }
  }

  async function renameSession(sessionId: string, title: string) {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (!res.ok) {
        console.error("Failed to rename session", res.status);
        return;
      }

      await loadSessions();
      if (activeSessionId === sessionId) {
        await loadSession(sessionId);
      }
    } catch (error) {
      console.error("Failed to rename session", error);
    }
  }

  return (
    <main className="min-h-screen px-6 py-10 text-white">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[280px_minmax(0,2fr)_minmax(340px,1fr)]">
        <div className="space-y-4">
          <ChatSessionsPanel
            sessions={sessions}
            loading={sessionsLoading}
            error={sessionsError}
            activeSessionId={activeSessionId}
            onSelectSession={loadSession}
            onRenameSession={renameSession}
          />

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">
              Upload
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              Nạp tài liệu vào RAG
            </h2>
            <div className="mt-6 space-y-4">
              <Uploader disabled={!authReady} />
              {!authReady ? (
                <p className="text-sm text-white/50">Đang chờ xác thực...</p>
              ) : null}
              <UploadEmptyState />
              <UploadSkeleton />
            </div>
          </section>
        </div>

        <ChatPanel
          sessionId={activeSessionId}
          initialMessages={initialMessages}
          onStateChange={setChatState}
          onActiveCitationsChange={setActiveCitationCount}
          onSessionCreated={(sessionId) => {
            setActiveSessionId(sessionId);
            void loadSessions();
          }}
        />

        <aside className="hidden lg:block">
          <div className="sticky top-6 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">
              3D ambient
            </p>
            <div className="mt-4">
              <Rag3DScene
                state={chatState}
                activeCitations={activeCitationCount}
              />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
