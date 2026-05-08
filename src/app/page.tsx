import Link from "next/link";
import { AuthBar } from "@/components/auth-bar";

const capabilities = [
  "Upload tài liệu an toàn theo user",
  "Chat streaming + session history",
  "Retrieval logs + citations",
  "3D ambient state theo câu trả lời",
] as const;

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
          <AuthBar />
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">
            Production baseline
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
            RAG chatbot trên Next.js, Supabase và 3D layer tách biệt
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/70">
            Một scaffold gọn, an toàn multi-tenant, có auth, upload, chat
            streaming, session history và ambient 3D.
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
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="rounded-full bg-violet-600 px-5 py-3 font-medium transition hover:bg-violet-500"
              href="/auth/login"
            >
              Đăng nhập
            </Link>
            <Link
              className="rounded-full border border-white/10 bg-black/20 px-5 py-3 font-medium text-white/80 transition hover:bg-white/5"
              href="/chat"
            >
              Mở chat
            </Link>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">
              What&apos;s included
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              Những gì đang có sẵn
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {capabilities.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/75"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">
              Quick notes
            </p>
            <h2 className="mt-3 text-2xl font-semibold">Luồng hiện tại</h2>
            <ul className="mt-6 space-y-3 text-sm text-white/70">
              <li>• Login bằng magic link trước khi dùng upload/chat.</li>
              <li>• Sessions chỉ load khi auth đã sẵn sàng.</li>
              <li>• Chat tự tạo session mới khi chưa có sessionId.</li>
              <li>• 3D scene đổi state theo chat, không gây giật UI.</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
