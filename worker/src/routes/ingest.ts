import { Router, Request, Response } from "express";
import { parseFileToText, SupportedMime } from "../lib/parse";
import { chunkText } from "../lib/chunk";
import { embedBatch } from "../lib/embeddings";
import { createClient } from "@supabase/supabase-js";

const router = Router();
const BATCH_SIZE = 10;

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key);
}

interface IngestBody {
  fileBase64: string;
  mimeType: SupportedMime;
  documentId: string;
  ownerId: string;
  title?: string;
  sourceName?: string;
}

router.post("/", async (req: Request, res: Response) => {
  const startedAt = performance.now();
  const { fileBase64, mimeType, documentId, ownerId, title, sourceName } =
    req.body as IngestBody;

  if (!fileBase64 || !mimeType || !documentId || !ownerId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const supabase = getSupabase();

  try {
    // 1. Update status → processing
    await supabase
      .from("documents")
      .update({ status: "processing" })
      .eq("id", documentId);

    console.log(
      JSON.stringify({
        name: "worker.ingest.start",
        documentId,
        ownerId,
        mimeType,
        ts: new Date().toISOString(),
      })
    );

    // 2. Parse
    const buffer = Buffer.from(fileBase64, "base64");
    const text = await parseFileToText(buffer.buffer as ArrayBuffer, mimeType);

    // 3. Chunk
    const chunks = chunkText(text);
    console.log(
      JSON.stringify({
        name: "worker.ingest.chunked",
        documentId,
        chunkCount: chunks.length,
        ts: new Date().toISOString(),
      })
    );

    // 4. Embed + insert in batches
    let chunksInserted = 0;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddings = await embedBatch(
        batch.map((c) => c.content),
        { taskType: "RETRIEVAL_DOCUMENT" }
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

      if (insertError) throw new Error(`Insert chunks failed: ${insertError.message}`);
      chunksInserted += batch.length;
    }

    // 5. Update status → ready
    await supabase
      .from("documents")
      .update({ status: "ready" })
      .eq("id", documentId);

    const durationMs = Math.round(performance.now() - startedAt);
    console.log(
      JSON.stringify({
        name: "worker.ingest.success",
        documentId,
        ownerId,
        chunksInserted,
        durationMs,
        ts: new Date().toISOString(),
      })
    );

    return res.json({ ok: true, documentId, chunksInserted, durationMs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    await supabase
      .from("documents")
      .update({ status: "error" })
      .eq("id", documentId)
      .catch(() => {});

    console.error(
      JSON.stringify({
        name: "worker.ingest.error",
        documentId,
        ownerId,
        error: message,
        ts: new Date().toISOString(),
      })
    );

    return res.status(500).json({ error: message });
  }
});

export { router as ingestRouter };
