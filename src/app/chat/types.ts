export type UICitation = {
  index: number;
  chunkId: string;
  documentId: string;
  score: number;
  preview: string;
  metadata: Record<string, unknown>;
};

export type ChunkDetailResponse = {
  id: string;
  documentId: string;
  documentTitle: string | null;
  sourceName: string | null;
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};
