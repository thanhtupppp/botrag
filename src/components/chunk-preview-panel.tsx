"use client";

import type { ChunkDetailResponse } from "@/app/chat/types";

export function ChunkPreviewPanel({
  chunk,
}: {
  chunk: ChunkDetailResponse | null;
}) {
  if (!chunk) {
    return (
      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
        Chọn một citation để xem nội dung chi tiết.
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
      <p className="text-sm font-medium text-violet-200">Chunk detail</p>
      <p className="mt-2 text-sm text-white/80">
        {chunk.documentTitle ?? "(Không có tiêu đề)"}
      </p>
      <p className="mt-1 text-xs text-white/50">
        {chunk.sourceName ?? "Unknown source"} #{chunk.chunkIndex}
      </p>
      <div className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-sm text-white/75">
        {chunk.content}
      </div>
    </div>
  );
}
