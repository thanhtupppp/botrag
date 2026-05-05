#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const TEST_OWNER_ID = "00000000-0000-0000-0000-000000000001";
const GEMINI_MODEL = "gemini-embedding-001";
const BATCH_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:batchEmbedContents`;
const OUTPUT_DIM = 768;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
  const res = await fetch(`${BATCH_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${GEMINI_MODEL}`,
        taskType: "RETRIEVAL_DOCUMENT",
        output_dimensionality: OUTPUT_DIM,
        content: { parts: [{ text }] },
      })),
    }),
  });

  if (!res.ok) throw new Error(`Embed batch error ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as { embeddings: Array<{ values: number[] }> };
  return data.embeddings.map((e) => e.values);
}

function chunkText(text: string, size = 800, overlap = 120) {
  const chunks: { content: string; index: number }[] = [];
  const norm = text.replace(/\r\n/g, "\n").trim();
  let start = 0,
    i = 0;

  while (start < norm.length) {
    const end = Math.min(start + size, norm.length);
    chunks.push({ content: norm.slice(start, end), index: i++ });
    if (end === norm.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

const SAMPLE_TEXT = `
# Tài liệu kiểm tra RAG Pipeline

## Giới thiệu
Đây là tài liệu mẫu để kiểm tra pipeline ingestion.
Hệ thống sẽ tự động chia nhỏ, nhúng và lưu vào Supabase.

## Tính năng chính
Chatbot có khả năng trả lời câu hỏi dựa trên nội dung tài liệu.
Dữ liệu được bảo vệ bằng Row Level Security.

## Cài đặt
Bước 1: Clone repository. Bước 2: npm install. Bước 3: Cấu hình .env.local. Bước 4: Chạy migration SQL.
`;

async function main() {
  console.log("=== TEST: Upload / Ingestion Pipeline ===");
  console.log(`    Model: ${GEMINI_MODEL}, dim: ${OUTPUT_DIM}`);

  const supabase = getServiceClient();
  let documentId: string | null = null;

  try {
    console.log("\n[1] Inserting document...");
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .insert({
        owner_id: TEST_OWNER_ID,
        title: "[TEST] Pipeline Doc",
        source_name: "test.md",
        mime_type: "text/markdown",
        status: "processing",
      })
      .select("id")
      .single();

    if (docErr || !doc) throw new Error(`Insert doc: ${docErr?.message}`);

    documentId = doc.id as string;
    console.log(`  ✅ Document: ${documentId}`);

    console.log("\n[2] Chunking...");
    const chunks = chunkText(SAMPLE_TEXT.trim());
    console.log(`  ✅ ${chunks.length} chunks`);

    console.log("\n[3] Embedding...");
    const embeddings = await embedBatch(chunks.map((c) => c.content));
    const dim = embeddings[0]?.length ?? 0;

    console.log(`  ✅ ${embeddings.length} embeddings, dimension: ${dim}`);
    if (dim !== OUTPUT_DIM) {
      console.warn(`  ⚠️  Dimension mismatch: ${dim} vs ${OUTPUT_DIM}`);
    }

    console.log("\n[4] Upserting chunks...");
    const { error: insertErr } = await supabase.from("document_chunks").insert(
      chunks.map((c, i) => ({
        document_id: documentId!,
        owner_id: TEST_OWNER_ID,
        chunk_index: c.index,
        content: c.content,
        metadata: { source: "test.md" },
        embedding: JSON.stringify(embeddings[i]),
      })),
    );

    if (insertErr) throw new Error(`Insert chunks: ${insertErr.message}`);

    console.log(`  ✅ ${chunks.length} chunks inserted`);

    await supabase.from("documents").update({ status: "ready" }).eq("id", documentId);
    console.log("  ✅ status → ready");

    console.log("\n[5] Testing match_chunks RPC...");
    const { data: matched, error: rpcErr } = await supabase.rpc("match_chunks", {
      query_embedding: embeddings[0],
      match_count: 3,
      filter_owner_id: TEST_OWNER_ID,
    });

    if (rpcErr) throw new Error(`match_chunks: ${rpcErr.message}`);

    const results = matched as Array<{ similarity: number; content: string }>;

    if (results.length === 0) throw new Error("match_chunks returned 0 results");

    console.log(`  ✅ match_chunks: ${results.length} results`);
    results.forEach((r, i) =>
      console.log(
        `     [${i + 1}] score=${r.similarity.toFixed(4)} | ${r.content
          .slice(0, 60)
          .replace(/\n/g, " ")}...`,
      ),
    );

    console.log("\n✅ All ingestion tests passed!\n");
  } catch (err) {
    console.error("\n❌ Test failed:", err);
  } finally {
    if (documentId) {
      await getServiceClient().from("documents").delete().eq("id", documentId);
      console.log("[cleanup] Done.");
    }
  }
}

main();
