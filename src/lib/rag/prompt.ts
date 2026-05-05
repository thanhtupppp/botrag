import type { RetrievedChunk } from "./types";

export function buildRagPrompt(question: string, chunks: RetrievedChunk[]) {
  const context = chunks
    .map((chunk, index) => `[#${index + 1}] ${chunk.content}`)
    .join("\n\n");

  return [
    "Bạn là trợ lý RAG. Chỉ trả lời dựa trên ngữ cảnh được cung cấp.",
    "Nếu không đủ thông tin, hãy nói không đủ dữ liệu trong tài liệu.",
    "",
    `Câu hỏi: ${question}`,
    "",
    "Ngữ cảnh:",
    context || "(trống)",
  ].join("\n");
}
