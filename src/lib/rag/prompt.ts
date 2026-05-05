import type { RetrievedChunk } from "./types";

export function buildRagPrompt(question: string, chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return [
      "Bạn là trợ lý AI chức năng RAG.",
      "Không tìm thấy tài liệu liên quan đến câu hỏi này.",
      "Hãy trả lời: \"Không tìm thấy thông tin phù hợp trong tài liệu của bạn. Vui lòng upload thêm tài liệu hoặc hỏi câu khác.\"",
      "",
      `Câu hỏi: ${question}`,
    ].join("\n");
  }

  const context = chunks
    .map((chunk, i) => {
      const source = (chunk.metadata?.headings as string[] | undefined)?.join(" > ") || "";
      return `[#${i + 1}]${source ? ` (${source})` : ""}\n${chunk.content}`;
    })
    .join("\n\n---\n\n");

  return [
    "Bạn là trợ lý AI chức năng RAG. Chỉ trả lời dựa trên ngữ cảnh được cung cấp.",
    "Nếu không đủ thông tin, hãy nói rõ: không đủ dữ liệu trong tài liệu đã tải lên.",
    "Khi trích dẫn, dùng ký hiệu [#N] để chỉ rõ nguồn.",
    "Trả lời bằng tiếng Việt nếu câu hỏi bằng tiếng Việt.",
    "",
    `Câu hỏi: ${question}`,
    "",
    "Ngữ cảnh tài liệu:",
    context,
  ].join("\n");
}
