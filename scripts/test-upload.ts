#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const TEST_OWNER_ID = "00000000-0000-0000-0000-000000000001";
const GEMINI_MODEL = "text-embedding-005";
const BATCH_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:batchEmbedContents`;
const EXPECTED_DIM = 768;

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
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_DOCUMENT",
      })),
    }),
  });
  if (!res.ok) throw new Error(`Embed batch error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { embeddings: Array<{ values: number[] }> };
  const vecs = data.embeddings.map((e) => e.values);
  const badDim = vecs.find((v) => v.length !== EXPECTED_DIM);
  if (badDim) throw new Error(`Unexpected dimension: ${badDim.length}, expected ${EXPECTED_DIM}`);
  return vecs;
}

function chunkText(text: string, size = 800, overlap = 120) {
  const chunks: { content: string; index: number }[] = [];
  const norm = text.replace(/\r\n/g, "\n").trim();
  let start = 0, i = 0;
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
Mô hình 3D tương tác phản ứng theo trạng thái của chatbot.
Dữ liệu được bảo vệ bằng Row Level Security.

## Cài đặt
Bước 1: Clone repository về máy local.
Bước 2: Cài đặt dependencies với npm install.
Bước 3: Cấu hình biến môi trường trong file .env.local.
Bước 4: Chạy migration SQL trên Supabase Dashboard.
Bước 5: Khởi động server với npm run dev.
`;

async function main() {
  console.log("=== TEST: Upload / Ingestion Pipeline ===");
  console.log(`    Embedding model: ${GEMINI_MODEL}`);

  const supabase = getServiceClient();
  let documentId: string | null = null;

  try {
    // Step 1: Insert document
    console.log("\n[1] Inserting document record...");
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .insert({
        owner_id: TEST_OWNER_ID,
        title: "[TEST] RAG Pipeline Test Doc",
        source_name: "test.md",
        mime_type: "text/markdown",
        status: "processing",
      })
      .select("id")
      .single();

    if (docErr || !doc) throw new Error(`Insert doc failed: ${docErr?.message}`);
    documentId = doc.id as string;
    console.log(`  ✅ Document created: ${documentId}`);

    // Step 2: Chunk
    console.log("\n[2] Chunking text...");
    const chunks = chunkText(SAMPLE_TEXT.trim());
    console.log(`  ✅ ${chunks.length} chunks`);
    chunks.forEach((c, i) =>
      console.log(`     [${i}] ${c.content.slice(0, 70).replace(/\n/g, " ")}...`)
    );

    // Step 3: Embed
    console.log("\n[3] Embedding...");
    const embeddings = await embedBatch(chunks.map((c) => c.content));
    console.log(`  ✅ ${embeddings.length} embeddings, dimension: ${embeddings[0].length}`);

    // Step 4: Upsert
    console.log("\n[4] Upserting chunks to Supabase...");
    const rows = chunks.map((chunk, idx) => ({
      document_id: documentId!,
      owner_id: TEST_OWNER_ID,
      chunk_index: chunk.index,
      content: chunk.content,
      metadata: { source: "test.md" },
      embedding: JSON.stringify(embeddings[idx]),
    }));
    const { error: insertErr } = await supabase.from("document_chunks").insert(rows);
    if (insertErr) throw new Error(`Insert chunks failed: ${insertErr.message}`);
    console.log(`  ✅ ${rows.length} chunks inserted`);

    // Step 5: Mark ready
    await supabase.from("documents").update({ status: "ready" }).eq("id", documentId);
    console.log("  ✅ Document status → ready");

    // Step 6: Test match_chunks RPC
    console.log("\n[5] Testing match_chunks RPC...");
    const { data: matched, error: rpcErr } = await supabase.rpc("match_chunks", {
      query_embedding: embeddings[0],
      match_count: 3,
      filter_owner_id: TEST_OWNER_ID,
    });
    if (rpcErr) throw new Error(`match_chunks RPC failed: ${rpcErr.message}`);

    const results = matched as Array<{ similarity: number; content: string }>;
    if (results.length === 0) throw new Error("match_chunks returned 0 results — kiểm tra RLS và migration");

    console.log(`  ✅ match_chunks returned ${results.length} results`);
    results.forEach((r, i) =>
      console.log(`     [${i + 1}] score=${r.similarity.toFixed(4)} | ${r.content.slice(0, 60).replace(/\n/g, " ")}...`)
    );

    console.log("\n✅ All ingestion tests passed!\n");
  } catch (err) {
    console.error("\n❌ Test failed:", err);
  } finally {
    if (documentId) {
      console.log("[cleanup] Removing test document...");
      await getServiceClient().from("documents").delete().eq("id", documentId);
      console.log("[cleanup] Done.");
    }
  }
}

main();
