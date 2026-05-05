"use client";

import { useState } from "react";
import { ChatPanel, type ChatState } from "@/components/chat-panel";
import { Rag3DScene } from "@/components/rag-3d-scene";
import { Uploader } from "@/components/uploader";
import { UploadEmptyState } from "@/components/upload-empty-state";
import { UploadSkeleton } from "@/components/upload-skeleton";

export default function ChatPage() {
  const [chatState, setChatState] = useState<ChatState>("idle");
  const [activeCitationCount, setActiveCitationCount] = useState(0);

  return (
    <main className="min-h-screen px-6 py-10 text-white">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
        <div className="space-y-4">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">
              Upload
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              Nạp tài liệu vào RAG
            </h2>
            <div className="mt-6 space-y-4">
              <Uploader />
              <UploadEmptyState />
              <UploadSkeleton />
            </div>
          </section>

          <ChatPanel
            onStateChange={setChatState}
            onActiveCitationsChange={setActiveCitationCount}
          />
        </div>

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
