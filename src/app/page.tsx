import Link from 'next/link';
import { Uploader } from '@/components/uploader';

const states = ['idle', 'thinking', 'streaming', 'error'] as const;

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">
            Production baseline
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
            RAG chatbot trên Next.js, Supabase và 3D layer tách biệt
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/70">
            Project scaffold tối giản để dựng upload, retrieval, chat streaming
            và scene 3D độc lập.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm text-white/70">
            <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2">
              Next.js App Router
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2">
              Supabase + pgvector
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2">
              Vercel AI SDK
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2">
              React Three Fiber
            </span>
          </div>
          <div className="mt-8 flex gap-3">
            <Link
              className="rounded-full bg-violet-600 px-5 py-3 font-medium hover:bg-violet-500"
              href="/chat"
            >
              Mở chat
            </Link>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">Uploader</p>
            <h2 className="mt-3 text-2xl font-semibold">Upload docx / pdf / txt / md</h2>
            <div className="mt-6">
              <Uploader />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {states.map((state) => (
              <div
                key={state}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <p className="text-sm text-white/50">3D state</p>
                <p className="mt-2 text-2xl font-semibold capitalize">{state}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
