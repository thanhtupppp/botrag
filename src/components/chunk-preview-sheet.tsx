"use client";

import type { ChunkDetailResponse } from "@/app/chat/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chunk: ChunkDetailResponse | null;
};

export function ChunkPreviewSheet({ open, onOpenChange, chunk }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 p-4">
      <button
        className="absolute inset-0 cursor-default"
        aria-label="Close preview"
        onClick={() => onOpenChange(false)}
      />
      <aside className="relative z-10 h-full w-full max-w-[480px] overflow-hidden rounded-3xl border border-white/10 bg-[#0b1020] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/40">
              Chunk preview
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              {chunk?.documentTitle ?? "Xem nguồn"}
            </h3>
            <p className="mt-1 text-xs text-white/50">
              {chunk?.sourceName ?? "Unknown source"} · đoạn #
              {chunk?.chunkIndex ?? "-"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 transition hover:bg-white/5"
          >
            Đóng
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm text-white/75">
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-white/80">
            {chunk?.content ?? "Chưa có nội dung."}
          </pre>
          {chunk?.metadata ? (
            <pre className="max-h-40 overflow-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-white/50">
              {JSON.stringify(chunk.metadata, null, 2)}
            </pre>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
