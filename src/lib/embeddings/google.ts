import type { EmbeddingProvider } from "./provider";

const GEMINI_EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent`;
const BATCH_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents`;

function getApiKey(): string {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
  return key;
}

export const googleEmbeddingProvider: EmbeddingProvider = {
  async embed(text: string): Promise<number[]> {
    const apiKey = getApiKey();
    const res = await fetch(`${EMBEDDING_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_DOCUMENT",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini embed error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as { embedding: { values: number[] } };
    return data.embedding.values;
  },

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const apiKey = getApiKey();

    const requests = texts.map((text) => ({
      model: `models/${GEMINI_EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_DOCUMENT",
    }));

    const res = await fetch(`${BATCH_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini batchEmbed error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as {
      embeddings: Array<{ values: number[] }>;
    };
    return data.embeddings.map((e) => e.values);
  },
};
