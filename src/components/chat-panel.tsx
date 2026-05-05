"use client";

import { useMemo, useRef, useState } from "react";

type Citation = {
  index: number;
  documentId: string;
  score: number;
  preview: string;
  metadata: Record<string, unknown>;
};

type ChatState = "idle" | "thinking" | "streaming" | "error";

export function ChatPanel() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [state, setState] = useState<ChatState>("idle");
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(
    null,
  );
  const answerRef = useRef<HTMLDivElement | null>(null);

  const canSend = question.trim().length > 0 && !loading;

  const citationText = useMemo(
    () => citations.map((c) => `[#${c.index}] ${c.preview}`).join("\n\n"),
    [citations],
  );

  async function sendQuestion() {
    setLoading(true);
    setState("thinking");
    setAnswer("");
    setCitations([]);
    setSelectedCitation(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const header = res.headers.get("x-rag-citations");
      if (header) {
        setCitations(JSON.parse(header) as Citation[]);
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
          answerRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
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

        <div
          ref={answerRef}
          className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-white/50">Assistant</p>
            {loading ? (
              <span className="text-xs text-violet-300">streaming...</span>
            ) : null}
          </div>
          <div className="mt-2 whitespace-pre-wrap text-white/85">
            {answer || "Chưa có phản hồi."}
          </div>
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
                onClick={() => setSelectedCitation(c)}
                className="block w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-left transition hover:border-violet-400/40 hover:bg-white/5"
              >
                <p className="font-medium text-white">
                  [#${c.index}] score {c.score}
                </p>
                <p className="mt-2 line-clamp-4">{c.preview}</p>
              </button>
            ))
          ) : (
            <p>Chưa có citation nào.</p>
          )}
        </div>

        {selectedCitation ? (
          <div className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
            <p className="text-sm font-medium text-violet-200">
              Selected citation
            </p>
            <p className="mt-2 text-sm text-white/80">
              Document: {selectedCitation.documentId}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-white/70">
              {selectedCitation.preview}
            </p>
          </div>
        ) : null}

        {citationText ? (
          <pre className="mt-6 whitespace-pre-wrap text-xs text-white/45">
            {citationText}
          </pre>
        ) : null}
      </aside>
    </div>
  );
}
