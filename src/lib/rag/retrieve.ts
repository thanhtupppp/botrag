import { createServiceClient } from "@/lib/supabase/server";
import { googleEmbeddingProvider } from "@/lib/embeddings/google";
import type { RetrievedChunk } from "./types";

export interface RetrieveOptions {
  k?: number;
  ownerId: string;
  minSimilarity?: number;
}

export async function retrieveTopKChunks(
  query: string,
  options: RetrieveOptions
): Promise<RetrievedChunk[]> {
  const { k = 5, ownerId, minSimilarity = 0.3 } = options;

  const embedding = await googleEmbeddingProvider.embed(query);

  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: embedding,
    match_count: k,
    filter_owner_id: ownerId,
  });

  if (error) throw new Error(`Retrieval error: ${error.message}`);
  if (!data) return [];

  return (
    data as Array<{
      id: string;
      document_id: string;
      content: string;
      metadata: Record<string, unknown>;
      similarity: number;
    }>
  )
    .filter((row) => row.similarity >= minSimilarity)
    .map((row) => ({
      id: row.id,
      documentId: row.document_id,
      content: row.content,
      score: row.similarity,
      metadata: row.metadata,
    }));
}
