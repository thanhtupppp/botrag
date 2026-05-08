import { chunkText } from "./chunk";
import { embedBatch } from "@/lib/embeddings/google";
import { createServiceClient } from "@/lib/supabase/server";
import { logEvent, measureAsync } from "@/lib/observability";

const BATCH_SIZE = 10;
const MAX_EMBED_RETRIES = 3;
const DEFAULT_EMBED_RETRY_MS = 1200;

function getRetryDelayMs(error: unknown) {
  if (!(error instanceof Error)) return null;
  const match = error.message.match(/Please retry in ([0-9.]+)s/i);
  if (match) {
    return Math.ceil(Number(match[1]) * 1000);
  }
  return null;
}

async function embedBatchWithRetry(
  texts: string[],
  context: { documentId: string; ownerId: string; batchSize: number },
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_EMBED_RETRIES; attempt += 1) {
    try {
      return await measureAsync(
        "rag.ingest.embed_batch",
        () => embedBatch(texts),
        { ...context, attempt },
      );
    } catch (error) {
      lastError = error;
      const retryDelayMs =
        getRetryDelayMs(error) ?? DEFAULT_EMBED_RETRY_MS * attempt;
      logEvent(
        "rag.ingest.embed_batch.retry",
        {
          ...context,
          attempt,
          retryDelayMs,
          error: String(error instanceof Error ? error.message : error),
        },
        "warn",
      );

      if (attempt === MAX_EMBED_RETRIES) break;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Embedding failed after retries");
}

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
  options: IngestOptions,
): Promise<IngestResult> {
  const supabase = createServiceClient();
  const { ownerId, title, sourceName, mimeType, storagePath } = options;

  const docStartedAt = performance.now();
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      owner_id: ownerId,
      title,
      source_name: sourceName,
      mime_type: mimeType,
      storage_path: storagePath ?? null,
      status: "processing",
    })
    .select("id")
    .single();

  if (docError || !doc) {
    logEvent(
      "rag.ingest.create_document.error",
      {
        ownerId,
        title,
        sourceName,
        mimeType,
        error: docError?.message ?? "Failed to create document",
      },
      "error",
    );
    throw new Error(`Failed to create document: ${docError?.message}`);
  }

  const documentId = doc.id as string;
  logEvent("rag.ingest.create_document.success", {
    documentId,
    ownerId,
    title,
    sourceName,
    mimeType,
    durationMs: Math.round(performance.now() - docStartedAt),
  });

  try {
    const chunkStartedAt = performance.now();
    const chunks = chunkText(text);
    logEvent("rag.ingest.chunking", {
      documentId,
      ownerId,
      chunkCount: chunks.length,
      durationMs: Math.round(performance.now() - chunkStartedAt),
    });

    if (chunks.length === 0) {
      await supabase
        .from("documents")
        .update({ status: "empty" })
        .eq("id", documentId);
      return { documentId, chunksInserted: 0 };
    }

    let chunksInserted = 0;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchStartedAt = performance.now();
      const embeddings = await embedBatchWithRetry(
        batch.map((c) => c.content),
        {
          documentId,
          ownerId,
          batchSize: batch.length,
        },
      );

      const rows = batch.map((chunk, idx) => ({
        document_id: documentId,
        owner_id: ownerId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        metadata: chunk.metadata,
        embedding: JSON.stringify(embeddings[idx]),
      }));

      const { error: insertError } = await supabase
        .from("document_chunks")
        .insert(rows);

      if (insertError) {
        logEvent(
          "rag.ingest.insert_chunks.error",
          {
            documentId,
            ownerId,
            batchSize: batch.length,
            error: insertError.message,
          },
          "error",
        );
        throw new Error(`Failed to insert chunks: ${insertError.message}`);
      }

      chunksInserted += batch.length;
      logEvent("rag.ingest.insert_chunks.success", {
        documentId,
        ownerId,
        batchSize: batch.length,
        durationMs: Math.round(performance.now() - batchStartedAt),
        chunksInserted,
      });
    }

    await supabase
      .from("documents")
      .update({ status: "ready" })
      .eq("id", documentId);

    logEvent("rag.ingest.success", {
      documentId,
      ownerId,
      chunksInserted,
      durationMs: Math.round(performance.now() - docStartedAt),
    });

    return { documentId, chunksInserted };
  } catch (err) {
    await supabase
      .from("documents")
      .update({ status: "error" })
      .eq("id", documentId);

    logEvent(
      "rag.ingest.error",
      {
        documentId,
        ownerId,
        error: String(err instanceof Error ? err.message : err),
      },
      "error",
    );
    throw err;
  }
}
