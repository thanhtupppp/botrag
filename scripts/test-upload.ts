#!/usr/bin/env npx tsx
/**
 * Test: Full ingestion pipeline (parse → chunk → embed → upsert)
 * Usage: npx tsx scripts/test-upload.ts
 *
 * Yêu cầu: SUPABASE_SERVICE_ROLE_KEY + GOOGLE_GENERATIVE_AI_API_KEY trong .env.local
 * Test dùng service role nên không cần auth user thật.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const TEST_OWNER_ID = "00000000-0000-0000-0000-000000000001"; // UUID giả cho test

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

// --- Inline helpers (tránh import path alias khi chạy script) ---

const GEMINI_MODEL = "text-embedding-004";
const BATCH_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:batchEmbedContents`;

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
  return data.embeddings.map((e) => e.values);
}

function chunkTextSimple(text: string, size = 800, overlap = 120) {
  const chunks: { content: string; index: number }[] = [];
  let start = 0, i = 0;
  const norm = text.replace(/\r\n/g, "\n").trim();
  while (start < norm.length) {
    const end = Math.min(start + size, norm.length);
    chunks.push({ content: norm.slice(start, end), index: i++ });
    if (end === norm.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

// ----------------------------------------------------------------

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
    const chunks = chunkTextSimple(SAMPLE_TEXT.trim());
    console.log(`  ✅ ${chunks.length} chunks created`);
    chunks.forEach((c, i) =>
      console.log(`     Chunk ${i}: ${c.content.slice(0, 60).replace(/\n/g, " ")}...`)
    );

    // Step 3: Embed
    console.log("\n[3] Embedding chunks via Gemini...");
    const embeddings = await embedBatch(chunks.map((c) => c.content));
    console.log(`  ✅ ${embeddings.length} embeddings returned, dimension: ${embeddings[0].length}`);

    if (embeddings[0].length !== 768) {
      throw new Error(`Dimension mismatch: expected 768, got ${embeddings[0].length}`);
    }

    // Step 4: Upsert chunks
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

    // Step 6: Verify via match_chunks RPC
    console.log("\n[5] Testing match_chunks RPC...");
    const queryEmbed = embeddings[0]; // dùng embedding chunk đầu làm query
    const { data: matched, error: rpcErr } = await supabase.rpc("match_chunks", {
      query_embedding: queryEmbed,
      match_count: 3,
      filter_owner_id: TEST_OWNER_ID,
    });

    if (rpcErr) throw new Error(`match_chunks RPC failed: ${rpcErr.message}`);
    console.log(`  ✅ match_chunks returned ${(matched as unknown[]).length} results`);
    (matched as Array<{ similarity: number; content: string }>).forEach((r, i) => {
      console.log(`     [${i + 1}] score=${r.similarity.toFixed(4)} | ${r.content.slice(0, 60).replace(/\n/g, " ")}...`);
    });

    console.log("\n✅ All ingestion tests passed!\n");
  } catch (err) {
    console.error("\n❌ Test failed:", err);
  } finally {
    // Cleanup: xóa test data
    if (documentId) {
      console.log("[cleanup] Removing test document...");
      await getServiceClient().from("documents").delete().eq("id", documentId);
      console.log("[cleanup] Done.");
    }
  }
}

main();
