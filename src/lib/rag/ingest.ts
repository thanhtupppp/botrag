import { chunkText } from "./chunk";
import { googleEmbeddingProvider } from "@/lib/embeddings/google";
import { createServiceClient } from "@/lib/supabase/server";

const BATCH_SIZE = 10;

export interface IngestOptions {
  ownerId: string;
  title: string;
  sourceName: string;
  mimeType: string;
  storagePath?: string;
}

export interface IngestResult {
  documentId: string;
  chunksInserted: number;
}

export async function ingestText(
  text: string,
  options: IngestOptions
): Promise<IngestResult> {
  const supabase = createServiceClient();

  // 1. Insert document record
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      owner_id: options.ownerId,
      title: options.title,
      source_name: options.sourceName,
      mime_type: options.mimeType,
      storage_path: options.storagePath ?? null,
      status: "processing",
    })
    .select("id")
    .single();

  if (docError || !doc) {
    throw new Error(`Failed to create document: ${docError?.message}`);
  }

  const documentId = doc.id as string;

  try {
    // 2. Chunk
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      await supabase
        .from("documents")
        .update({ status: "empty" })
        .eq("id", documentId);
      return { documentId, chunksInserted: 0 };
    }

    // 3. Embed in batches
    let chunksInserted = 0;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddings = await googleEmbeddingProvider.embedBatch(
        batch.map((c) => c.content)
      );

      const rows = batch.map((chunk, idx) => ({
        document_id: documentId,
        owner_id: options.ownerId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        metadata: chunk.metadata,
        embedding: JSON.stringify(embeddings[idx]),
      }));

      const { error: insertError } = await supabase
        .from("document_chunks")
        .insert(rows);

      if (insertError) {
        throw new Error(`Failed to insert chunks: ${insertError.message}`);
      }

      chunksInserted += batch.length;
    }

    // 4. Mark done
    await supabase
      .from("documents")
      .update({ status: "ready" })
      .eq("id", documentId);

    return { documentId, chunksInserted };
  } catch (err) {
    await supabase
      .from("documents")
      .update({ status: "error" })
      .eq("id", documentId);
    throw err;
  }
}
