/**
 * Gemini Embedding (text-only)
 * Model: gemini-gemini-embedding-001
 * Output dimension: 768 (set via output_dimensionality)
 */
const MODEL = "gemini-gemini-embedding-001";
const BASE = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`;

function apiKey(): string {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
  return key;
}

interface EmbedOptions {
  taskType?:
    | "SEMANTIC_SIMILARITY"
    | "CLASSIFICATION"
    | "CLUSTERING"
    | "RETRIEVAL_DOCUMENT"
    | "RETRIEVAL_QUERY"
    | "CODE_RETRIEVAL_QUERY"
    | "QUESTION_ANSWERING"
    | "FACT_VERIFICATION";
  /** Override embedding size. Default 768 to khớp schema vector(768). */
  outputDimensionality?: number;
}

const DEFAULT_OUTPUT_DIM = 768;
const DEFAULT_TASK_DOCUMENT: EmbedOptions["taskType"] = "RETRIEVAL_DOCUMENT";
const DEFAULT_TASK_QUERY: EmbedOptions["taskType"] = "RETRIEVAL_QUERY";

/** Embed một đoạn văn bản. */
export async function embed(
  text: string,
  opts: EmbedOptions = {},
): Promise<number[]> {
  const {
    taskType = DEFAULT_TASK_DOCUMENT,
    outputDimensionality = DEFAULT_OUTPUT_DIM,
  } = opts;

  const res = await fetch(`${BASE}:embedContent?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // REST doc cho gemini-gemini-embedding-001 dùng trực tiếp model name, không cần prefix "models/"
      model: MODEL,
      taskType,
      output_dimensionality: outputDimensionality,
      content: {
        parts: [{ text }],
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`embed() failed ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { embedding: { values: number[] } };
  return data.embedding.values;
}

/**
 * Embed nhiều văn bản cùng lúc.
 * Dùng RETRIEVAL_DOCUMENT cho indexing, RETRIEVAL_QUERY cho search queries.
 */
export async function embedBatch(
  texts: string[],
  opts: EmbedOptions = {},
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const {
    taskType = DEFAULT_TASK_DOCUMENT,
    outputDimensionality = DEFAULT_OUTPUT_DIM,
  } = opts;

  const res = await fetch(`${BASE}:batchEmbedContents?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: MODEL,
        taskType,
        output_dimensionality: outputDimensionality,
        content: {
          parts: [{ text }],
        },
      })),
    }),
  });

  if (!res.ok) {
    throw new Error(`embedBatch() failed ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    embeddings: Array<{ values: number[] }>;
  };
  return data.embeddings.map((e) => e.values);
}

export const EMBEDDING_MODEL = MODEL;
export const EMBEDDING_DIM = DEFAULT_OUTPUT_DIM;
