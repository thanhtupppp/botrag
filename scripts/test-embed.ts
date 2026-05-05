#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });

// Gemini Embedding 1 = embedding-001, dimension 768
const GEMINI_MODEL = "embedding-001";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent`;
const BATCH_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:batchEmbedContents`;
const EXPECTED_DIM = 768;

async function testSingleEmbed() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey)
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not set in .env.local");

  console.log("\n[1] Testing single embed...");
  const res = await fetch(`${API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      taskType: "RETRIEVAL_DOCUMENT",
      output_dimensionality: EXPECTED_DIM,
      content: { parts: [{ text: "RAG chatbot test tiếng Việt" }] },
    }),
  });

  if (!res.ok)
    throw new Error(`Embed failed ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as { embedding: { values: number[] } };
  const dim = data.embedding.values.length;
  console.log(
    `  ✅ Single embed OK — model: ${GEMINI_MODEL}, dimension: ${dim}`,
  );
  console.log(
    `  Sample: [${data.embedding.values
      .slice(0, 4)
      .map((v) => v.toFixed(6))
      .join(", ")}, ...]`,
  );

  if (dim !== EXPECTED_DIM) {
    console.warn(`  ⚠️  Dimension is ${dim}, schema expects ${EXPECTED_DIM}`);
    console.warn(
      `  → Cần chạy: ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(${dim});`,
    );
  }

  return dim;
}

async function testBatchEmbed(expectedDim: number) {
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
        model: GEMINI_MODEL,
        taskType: "RETRIEVAL_DOCUMENT",
        output_dimensionality: expectedDim,
        content: { parts: [{ text }] },
      })),
    }),
  });

  if (!res.ok)
    throw new Error(`Batch embed failed ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as {
    embeddings: Array<{ values: number[] }>;
  };
  const count = data.embeddings.length;
  const dims = data.embeddings.map((e) => e.values.length);
  console.log(
    `  ✅ Batch embed OK — ${count} vectors, dimensions: [${dims.join(", ")}]`,
  );

  // Summary
  console.log("\n[SUMMARY]");
  console.log(`  Model    : ${GEMINI_MODEL}`);
  console.log(`  Dimension: ${dim}`);
  console.log(
    `  Schema   : vector(${dim}) ${
      dim === 768 ? "✅ khp với migration hiện tại" : "⚠️  Cần update schema!"
    }`,
  );
}

async function main() {
  console.log("=== TEST: Gemini Embeddings ===");
  console.log(`    Model: ${GEMINI_MODEL}`);

  try {
    const dim = await testSingleEmbed();
    await testBatchEmbed(dim);
    console.log("\n✅ All embedding tests passed.\n");
  } catch (err) {
    console.error("\n❌ Embedding test failed:", err);
    process.exit(1);
  }
}

main();
