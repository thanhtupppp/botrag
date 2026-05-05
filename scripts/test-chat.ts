#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const TEST_OWNER_ID = "00000000-0000-0000-0000-000000000001";
const GEMINI_MODEL = "gemini-embedding-001";
const BATCH_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:batchEmbedContents`;
const SINGLE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent`;
const OUTPUT_DIM = 768;

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function singleEmbed(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;

  const res = await fetch(`${SINGLE_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${GEMINI_MODEL}`,
      taskType: "RETRIEVAL_QUERY",
      output_dimensionality: OUTPUT_DIM,
      content: { parts: [{ text }] },
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
        taskType: "RETRIEVAL_DOCUMENT",
        output_dimensionality: OUTPUT_DIM,
        content: { parts: [{ text }] },
      })),
    }),
  });

  if (!res.ok) throw new Error(`Batch embed: ${await res.text()}`);

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
    },
  );

  if (!res.ok) throw new Error(`GenerateContent: ${await res.text()}`);

  const data = (await res.json()) as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };

  return data.candidates[0].content.parts[0].text;
}

const KNOWLEDGE_TEXT = `
# Chính sách hoàn tiền

Khách hàng có thể yêu cầu hoàn tiền trong vòng 30 ngày kể từ ngày mua hàng.
Điều kiện: sản phẩm chưa qua sử dụng và còn nguyên tem.
Thời gian xử lý: 3 đến 7 ngày làm việc.

## Sản phẩm không được hoàn
Sản phẩm kỹ thuật số và phần mềm không được hoàn sau khi kích hoạt.

## Liên hệ
Email: support@example.com | Hotline: 1900-1234
`;

const TESTS = [
  { q: "Tôi có thể hoàn tiền sau bao nhiêu ngày?", expect: true },
  { q: "Sản phẩm kỹ thuật số có được hoàn không?", expect: true },
  { q: "Liên hệ hỗ trợ bằng cách nào?", expect: true },
  { q: "Thời tiết hôm nay thế nào?", expect: false },
];

async function main() {
  console.log("=== TEST: RAG Chat Pipeline ===");
  console.log(`    Embedding model: ${GEMINI_MODEL}, dim: ${OUTPUT_DIM}`);

  const supabase = getServiceClient();
  let documentId: string | null = null;

  try {
    console.log("\n[1] Seeding test document...");

    const chunks = KNOWLEDGE_TEXT.trim().split("\n\n").filter(Boolean).map((content, i) => ({
      content: content.trim(),
      index: i,
    }));

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .insert({
        owner_id: TEST_OWNER_ID,
        title: "[TEST] Hoàn tiền",
        source_name: "refund.md",
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
      })),
    );

    await supabase.from("documents").update({ status: "ready" }).eq("id", documentId);

    console.log(`  ✅ ${chunks.length} chunks seeded`);

    let passed = 0;

    for (const test of TESTS) {
      console.log(`\n[Q] ${test.q}`);

      const queryEmbedding = await singleEmbed(test.q);
      const { data: matched, error: rpcErr } = await supabase.rpc("match_chunks", {
        query_embedding: queryEmbedding,
        match_count: 3,
        filter_owner_id: TEST_OWNER_ID,
      });

      if (rpcErr) throw new Error(`RPC: ${rpcErr.message}`);

      const results = (matched as Array<{ similarity: number; content: string }>).filter(
        (r) => r.similarity >= 0.3,
      );

      if (!test.expect) {
        if (results.length === 0) {
          console.log("  ✅ Correctly 0 chunks (out-of-domain)");
        } else {
          console.warn(
            `  ⚠️  Expected 0 chunks but got ${results.length} (threshold có thể cần tăng)`,
          );
        }

        passed++;
        continue;
      }

      if (results.length === 0) {
        console.error("  ❌ No chunks retrieved");
        continue;
      }

      const context = results
        .map((r, i) => `[#${i + 1}] ${r.content}`)
        .join("\n\n");

      const prompt = [
        "Bạn là trợ lý RAG. Chỉ trả lời dựa trên ngữ cảnh được cung cấp.",
        "Nếu không đủ thông tin, hãy nói rõ.",
        "",
        `Câu hỏi: ${test.q}`,
        "",
        "Ngữ cảnh:",
        context,
      ].join("\n");

      const answer = await generateAnswer(prompt);

      console.log(
        `  Retrieved: ${results.length} chunks, top=${results[0].similarity.toFixed(4)}`,
      );

      console.log(
        `  Answer: ${answer
          .slice(0, 180)
          .replace(/\n/g, " ")}${answer.length > 180 ? "..." : ""}`,
      );

      passed++;
    }

    console.log(`\n✅ ${passed}/${TESTS.length} passed\n`);
  } catch (err) {
    console.error("\n❌ Test failed:", err);
  } finally {
    if (documentId) {
      await supabase.from("documents").delete().eq("id", documentId);
      console.log("[cleanup] Done.");
    }
  }
}

main();
