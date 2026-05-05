import { createServiceClient } from "@/lib/supabase/server";
import { googleEmbeddingProvider } from "@/lib/embeddings/google";
import type { RetrievedChunk } from "./types";

export interface RetrieveOptions {
  k?: number;
  ownerId: string;
  minSimilarity?: number;
}

// Production heuristic:
// - lọc theo minSimilarity (mặc định hơi thấp để không bỏ lỡ)
// - đồng thời dùng top-score gate ~0.6 để chặn query out-of-domain
//   nếu top result vẫn quá thấp.
const DEFAULT_MIN_SIMILARITY = 0.4;
const DEFAULT_TOP_SCORE_GATE = 0.6;

export async function retrieveTopKChunks(
  query: string,
  options: RetrieveOptions
): Promise<RetrievedChunk[]> {
  const {
    k = 5,
    ownerId,
    minSimilarity = DEFAULT_MIN_SIMILARITY,
  } = options;

  const embedding = await googleEmbeddingProvider.embed(query);

  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: embedding,
    match_count: k,
    filter_owner_id: ownerId,
  });

  if (error) throw new Error(`Retrieval error: ${error.message}`);
  if (!data) return [];

  const rows = data as Array<{
    id: string;
    document_id: string;
    content: string;
    metadata: Record<string, unknown>;
    similarity: number;
  }>;

  // Lọc các chunk có similarity >= minSimilarity
  const filtered = rows.filter((row) => row.similarity >= minSimilarity);
  if (filtered.length === 0) return [];

  // Top-score gate: nếu score cao nhất vẫn < DEFAULT_TOP_SCORE_GATE
  // coi như không đủ tự tin → trả [] để LLM biết là "không có ngữ cảnh phù hợp".
  if (filtered[0].similarity < DEFAULT_TOP_SCORE_GATE) {
    return [];
  }

  return filtered.map((row) => ({
    id: row.id,
    documentId: row.document_id,
    content: row.content,
    score: row.similarity,
    metadata: row.metadata,
  }));
}
