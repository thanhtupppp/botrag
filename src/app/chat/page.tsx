export default function ChatPage() {
  return (
    <main className="min-h-screen px-6 py-10 text-white">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">
            Chat
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            Grounded RAG conversation
          </h1>
          <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="rounded-2xl bg-white/5 p-4 text-white/80">
              User question sẽ đi qua route handler rồi mới gọi retrieval và
              LLM.
            </div>
            <div className="rounded-2xl bg-violet-500/15 p-4 text-white/90">
              Assistant response sẽ stream token và chỉ dùng chunks đã qua
              permission filter.
            </div>
          </div>
        </section>

        <aside className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">
            3D layer
          </p>
          <h2 className="mt-3 text-2xl font-semibold">State bridge</h2>
          <ul className="mt-5 space-y-3 text-sm text-white/70">
            <li>idle</li>
            <li>thinking</li>
            <li>streaming</li>
            <li>error</li>
          </ul>
        </aside>
      </div>
    </main>
  );
}
