export type ChatState = "idle" | "thinking" | "streaming" | "error";

export type RetrievedChunk = {
  id: string;
  documentId: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
};
