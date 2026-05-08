import { createServiceClient } from "@/lib/supabase/server";
import { embed } from "@/lib/embeddings/google";
import { logEvent, measureAsync } from "@/lib/observability";
import type { RetrievedChunk } from "./types";

function isEmbeddingQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("429") || message.includes("quota exceeded");
}

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
  options: RetrieveOptions,
): Promise<RetrievedChunk[]> {
  const { k = 5, ownerId, minSimilarity = DEFAULT_MIN_SIMILARITY } = options;

  const startedAt = performance.now();
  let embedding: number[];
  try {
    embedding = await measureAsync(
      "rag.retrieval.embedding",
      () => embed(query),
      { ownerId, k, minSimilarity },
    );
  } catch (error) {
    if (isEmbeddingQuotaError(error)) {
      logEvent(
        "rag.retrieval.embedding_quota",
        {
          ownerId,
          k,
          minSimilarity,
          error: String(error instanceof Error ? error.message : error),
        },
        "warn",
      );
      throw new Error(
        "Embedding quota exceeded. Please try again later or switch embedding provider.",
      );
    }
    throw error;
  }

  const supabase = createServiceClient();
  const rpcStartedAt = performance.now();
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: embedding,
    match_count: k,
    filter_owner_id: ownerId,
  });
  const rpcLatencyMs = Math.round(performance.now() - rpcStartedAt);

  if (error) {
    logEvent(
      "rag.retrieval.error",
      {
        ownerId,
        k,
        minSimilarity,
        rpcLatencyMs,
        totalLatencyMs: Math.round(performance.now() - startedAt),
        error: error.message,
      },
      "error",
    );
    throw new Error(`Retrieval error: ${error.message}`);
  }
  if (!data) return [];

  const rows = data as Array<{
    id: string;
    document_id: string;
    content: string;
    metadata: Record<string, unknown>;
    similarity: number;
  }>;

  const rawCount = rows.length;
  const filtered = rows.filter((row) => row.similarity >= minSimilarity);
  const filteredCount = filtered.length;
  const topScore = filtered[0]?.similarity ?? null;
  const gateRejected =
    filteredCount > 0 && filtered[0].similarity < DEFAULT_TOP_SCORE_GATE;
  const totalLatencyMs = Math.round(performance.now() - startedAt);

  logEvent("rag.retrieval.summary", {
    ownerId,
    k,
    minSimilarity,
    rawCount,
    filteredCount,
    topScore,
    rpcLatencyMs,
    totalLatencyMs,
    gateRejected,
  });

  if (filteredCount === 0 || gateRejected) {
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
