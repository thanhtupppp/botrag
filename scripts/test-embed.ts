#!/usr/bin/env npx tsx
/**
 * Test: Google Gemini embedding
 * Usage: npx tsx scripts/test-embed.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

// text-embedding-005: stable, dimension 768, replaces text-embedding-004
const GEMINI_MODEL = "text-embedding-005";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent`;
const BATCH_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:batchEmbedContents`;
const EXPECTED_DIM = 768;

async function testSingleEmbed() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not set in .env.local");

  console.log("\n[1] Testing single embed...");
  const res = await fetch(`${API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${GEMINI_MODEL}`,
      content: { parts: [{ text: "RAG chatbot test tiếng Việt" }] },
      taskType: "RETRIEVAL_DOCUMENT",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embed failed ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { embedding: { values: number[] } };
  const dim = data.embedding.values.length;

  if (dim !== EXPECTED_DIM) {
    throw new Error(
      `Dimension mismatch: expected ${EXPECTED_DIM}, got ${dim}.\n` +
      `Schema sẽ reject inserts! Cần chạy migration đổi vector(${dim}).`
    );
  }

  console.log(`  ✅ Single embed OK — model: ${GEMINI_MODEL}, dimension: ${dim}`);
  console.log(`  Sample: [${data.embedding.values.slice(0, 4).map(v => v.toFixed(6)).join(", ")}, ...]`);
}

async function testBatchEmbed() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
  const texts = [
    "Hướng dẫn cài đặt phần mềm",
    "Chính sách bảo mật dữ liệu",
    "Quy trình xử lý đơn hàng",
  ];

  console.log("\n[2] Testing batch embed (3 texts)...");
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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Batch embed failed ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { embeddings: Array<{ values: number[] }> };
  const count = data.embeddings.length;
  const dims = data.embeddings.map((e) => e.values.length);
  const allCorrect = dims.every((d) => d === EXPECTED_DIM);

  if (!allCorrect) {
    throw new Error(`Dimension mismatch in batch: got [${dims.join(", ")}], expected all ${EXPECTED_DIM}`);
  }

  if (count !== texts.length) {
    throw new Error(`Expected ${texts.length} embeddings, got ${count}`);
  }

  console.log(`  ✅ Batch embed OK — ${count} vectors, dimension: ${EXPECTED_DIM}`);
}

async function main() {
  console.log("=== TEST: Gemini Embeddings ===");
  console.log(`    Model: ${GEMINI_MODEL}`);
  try {
    await testSingleEmbed();
    await testBatchEmbed();
    console.log("\n✅ All embedding tests passed.\n");
  } catch (err) {
    console.error("\n❌ Embedding test failed:", err);
    process.exit(1);
  }
}

main();
