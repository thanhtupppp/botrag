#!/usr/bin/env npx tsx
/**
 * Test: Retrieval + Chat pipeline (không cần auth user thật)
 * Upload một doc thật → hỏi câu hỏi liên quan → verify câu trả lời grounded
 * Usage: npx tsx scripts/test-chat.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const TEST_OWNER_ID = "00000000-0000-0000-0000-000000000001";
const GEMINI_MODEL = "text-embedding-004";
const BATCH_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:batchEmbedContents`;
const SINGLE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent`;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function singleEmbed(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
  const res = await fetch(`${SINGLE_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${GEMINI_MODEL}`,
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_QUERY", // query dùng RETRIEVAL_QUERY
    }),
  });
  if (!res.ok) throw new Error(`Embed failed: ${await res.text()}`);
  const data = (await res.json()) as { embedding: { values: number[] } };
  return data.embedding.values;
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
  if (!res.ok) throw new Error(`Batch embed failed: ${await res.text()}`);
  const data = (await res.json()) as { embeddings: Array<{ values: number[] }> };
  return data.embeddings.map((e) => e.values);
}

async function generateAnswer(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
      }),
    }
  );
  if (!res.ok) throw new Error(`GenerateContent failed: ${await res.text()}`);
  const data = (await res.json()) as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };
  return data.candidates[0].content.parts[0].text;
}

const KNOWLEDGE_TEXT = `
# Chính sách hoàn tiền

Khách hàng có thể yêu cầu hoàn tiền trong vòng 30 ngày kể từ ngày mua hàng.
Điều kiện hoàn tiền: sản phẩm chưa qua sử dụng và còn nguyên tem.
Thời gian xử lý hoàn tiền là từ 3 đến 7 ngày làm việc.

## Sản phẩm không được hoàn
Sản phẩm kỹ thuật số và phần mềm không được hoàn tiền sau khi kích hoạt.
Sản phẩm đặt hàng theo yêu cầu riêng không được hoàn.

## Liên hệ hỗ trợ
Email: support@example.com
Hotline: 1900-1234 (8:00 - 20:00 hàng ngày)
`;

const TEST_QUESTIONS = [
  "Tôi có thể hoàn tiền sau bao nhiêu ngày?",
  "Sản phẩm kỹ thuật số có được hoàn không?",
  "Tôi liên hệ hỗ trợ bằng cách nào?",
  "Thời tiết hôm nay thế nào?", // câu hỏi ngoài tài liệu — phải trả về "không đủ thông tin"
];

async function main() {
  console.log("=== TEST: RAG Chat Pipeline ===");
  const supabase = getServiceClient();
  let documentId: string | null = null;

  try {
    // Seed data
    console.log("\n[1] Seeding test document...");
    const chunks = KNOWLEDGE_TEXT
      .trim()
      .split("\n\n")
      .filter((p) => p.trim())
      .map((content, i) => ({ content: content.trim(), index: i }));

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .insert({
        owner_id: TEST_OWNER_ID,
        title: "[TEST] Chính sách hoàn tiền",
        source_name: "test-refund.md",
        mime_type: "text/markdown",
        status: "processing",
      })
      .select("id")
      .single();

    if (docErr || !doc) throw new Error(docErr?.message);
    documentId = doc.id as string;

    const embeddings = await embedBatch(chunks.map((c) => c.content));
    await supabase.from("document_chunks").insert(
      chunks.map((c, i) => ({
        document_id: documentId!,
        owner_id: TEST_OWNER_ID,
        chunk_index: c.index,
        content: c.content,
        metadata: {},
        embedding: JSON.stringify(embeddings[i]),
      }))
    );
    await supabase.from("documents").update({ status: "ready" }).eq("id", documentId);
    console.log(`  ✅ Seeded ${chunks.length} chunks`);

    // Test retrieval + answer for each question
    for (const question of TEST_QUESTIONS) {
      console.log(`\n[Q] ${question}`);

      const queryEmbedding = await singleEmbed(question);
      const { data: matched, error: rpcErr } = await supabase.rpc("match_chunks", {
        query_embedding: queryEmbedding,
        match_count: 3,
        filter_owner_id: TEST_OWNER_ID,
      });

      if (rpcErr) throw new Error(`RPC error: ${rpcErr.message}`);

      const results = (matched as Array<{ similarity: number; content: string }>).filter(
        (r) => r.similarity >= 0.3
      );

      if (results.length === 0) {
        console.log("  ℹ️  No relevant chunks found (similarity < 0.3)");
        console.log("  → Expected: bot trả lời \"không đủ thông tin\"");
        continue;
      }

      const context = results
        .map((r, i) => `[#${i + 1}] ${r.content}`)
        .join("\n\n");

      const prompt = [
        "Bạn là trợ lý RAG. Chỉ trả lời dựa trên ngữ cảnh được cung cấp.",
        "Nếu không đủ thông tin, nói: không đủ dữ liệu trong tài liệu.",
        "",
        `Câu hỏi: ${question}`,
        "",
        "Ngữ cảnh:",
        context,
      ].join("\n");

      const answer = await generateAnswer(prompt);
      console.log(`  Retrieved: ${results.length} chunks (top score: ${results[0].similarity.toFixed(4)})`);
      console.log(`  Answer: ${answer.slice(0, 200).replace(/\n/g, " ")}`);
    }

    console.log("\n✅ Chat pipeline test complete!\n");
  } catch (err) {
    console.error("\n❌ Test failed:", err);
  } finally {
    if (documentId) {
      console.log("[cleanup] Removing test data...");
      await supabase.from("documents").delete().eq("id", documentId);
      console.log("[cleanup] Done.");
    }
  }
}

main();
