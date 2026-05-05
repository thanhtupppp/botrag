"use client";

import { useMemo, useState } from "react";
import type { ChunkDetailResponse, UICitation } from "@/app/chat/types";
import { AnswerMarkdown } from "@/components/answer-markdown";
import { ChatEmptyState } from "@/components/chat-empty-state";
import { ChatMessageSkeleton } from "@/components/chat-message-skeleton";
import { ChunkPreviewSheet } from "@/components/chunk-preview-sheet";

export type ChatState = "idle" | "thinking" | "streaming" | "error";

export function ChatPanel() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [citations, setCitations] = useState<UICitation[]>([]);
  const [state, setState] = useState<ChatState>("idle");
  const [selectedChunk, setSelectedChunk] =
    useState<ChunkDetailResponse | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeCitation, setActiveCitation] = useState<number | null>(null);

  const canSend = question.trim().length > 0 && !loading;

  const citationText = useMemo(
    () => citations.map((c) => `[#${c.index}] ${c.preview}`).join("\n\n"),
    [citations],
  );

  async function loadChunkDetail(chunkId: string) {
    const res = await fetch(`/api/chunks/${chunkId}`);
    if (!res.ok) {
      throw new Error("Không tải được citation detail");
    }
    return (await res.json()) as ChunkDetailResponse;
  }

  async function openCitation(citation: UICitation) {
    const data = await loadChunkDetail(citation.chunkId);
    setSelectedChunk(data);
    setSheetOpen(true);
  }

  async function sendQuestion() {
    setLoading(true);
    setState("thinking");
    setAnswer("");
    setCitations([]);
    setSelectedChunk(null);
    setActiveCitation(null);
    setSheetOpen(false);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const header = res.headers.get("x-rag-citations");
      if (header) {
        setCitations(JSON.parse(header) as UICitation[]);
      }

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Chat request failed");
      }

      setState("streaming");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";

      while (true) {
        const result = await reader.read();
        if (result.done) break;
        if (result.value) {
          text += decoder.decode(result.value, { stream: true });
          setAnswer(text);
        }
      }

      setState("idle");
    } catch (error) {
      setState("error");
      setAnswer(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-white/50">Chat</p>
        <h1 className="mt-3 text-3xl font-semibold">
          Grounded RAG conversation
        </h1>

        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Đặt câu hỏi về tài liệu..."
          className="mt-6 min-h-32 w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm outline-none placeholder:text-white/35 focus:border-violet-500/60"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={sendQuestion}
            disabled={!canSend}
            className="rounded-full bg-violet-600 px-5 py-3 text-sm font-medium transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Đang trả lời..." : "Gửi câu hỏi"}
          </button>
          <span className="text-sm text-white/50">state: {state}</span>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-white/50">Assistant</p>
            {loading ? (
              <span className="text-xs text-violet-300">streaming...</span>
            ) : null}
          </div>

          {state === "thinking" && !answer ? <ChatMessageSkeleton /> : null}

          {answer || state === "error" ? (
            <AnswerMarkdown
              text={answer}
              citations={citations}
              onCitationHover={setActiveCitation}
            />
          ) : (
            <ChatEmptyState onSuggest={(q) => setQuestion(q)} />
          )}
        </div>
      </section>

      <aside className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-white/50">
          Citations
        </p>
        <div className="mt-4 space-y-4 text-sm text-white/70">
          {citations.length ? (
            citations.map((c) => (
              <button
                key={c.index}
                type="button"
                onMouseEnter={() => setActiveCitation(c.index)}
                onMouseLeave={() => setActiveCitation(null)}
                onClick={async () => {
                  await openCitation(c);
                }}
                className={`block w-full rounded-2xl border p-4 text-left transition ${
                  activeCitation === c.index
                    ? "border-violet-400/40 bg-violet-500/10"
                    : "border-white/10 bg-black/20 hover:border-violet-400/40 hover:bg-white/5"
                }`}
              >
                <p className="font-medium text-white">
                  [#{c.index}] score {c.score}
                </p>
                <p className="mt-2 line-clamp-4">{c.preview}</p>
              </button>
            ))
          ) : (
            <p>Chưa có citation nào.</p>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
          Click citation để xem nguồn chi tiết.
        </div>

        {citationText ? (
          <pre className="mt-6 whitespace-pre-wrap text-xs text-white/45">
            {citationText}
          </pre>
        ) : null}
      </aside>

      <ChunkPreviewSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        chunk={selectedChunk}
      />
    </div>
  );
}
