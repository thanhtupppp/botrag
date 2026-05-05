/**
 * Gemini Embedding 1 = embedding-001
 * Dimension: 768
 * API: v1beta embedContent / batchEmbedContents
 */
const MODEL = "embedding-001";
const BASE = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`;

function apiKey(): string {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
  return key;
}

/** Embed một củi văn bản. taskType: RETRIEVAL_DOCUMENT (index) | RETRIEVAL_QUERY (search) */
export async function embed(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT"
): Promise<number[]> {
  const res = await fetch(`${BASE}:embedContent?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${MODEL}`,
      content: { parts: [{ text }] },
      taskType,
    }),
  });
  if (!res.ok) throw new Error(`embed() failed ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { embedding: { values: number[] } };
  return data.embedding.values;
}

/** Embed nhiều văn bản cùng lúc. Dùng cho ingestion pipeline. */
export async function embedBatch(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT"
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const res = await fetch(`${BASE}:batchEmbedContents?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${MODEL}`,
        content: { parts: [{ text }] },
        taskType,
      })),
    }),
  });
  if (!res.ok) throw new Error(`embedBatch() failed ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { embeddings: Array<{ values: number[] }> };
  return data.embeddings.map((e) => e.values);
}

export const EMBEDDING_MODEL = MODEL;
export const EMBEDDING_DIM = 768;
