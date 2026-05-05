import { ChatPanel } from "@/components/chat-panel";
import { Uploader } from "@/components/uploader";

export default function ChatPage() {
  return (
    <main className="min-h-screen px-6 py-10 text-white">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">
            Upload
          </p>
          <h2 className="mt-3 text-2xl font-semibold">Nạp tài liệu vào RAG</h2>
          <div className="mt-6">
            <Uploader />
          </div>
        </section>

        <ChatPanel />
      </div>
    </main>
  );
}
