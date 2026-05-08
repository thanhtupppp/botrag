import { GoogleGenerativeAI } from "@google/generative-ai";

export const EMBEDDING_MODEL = "text-embedding-004";
export const EMBEDDING_DIM = 768;

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? ""
);

export async function embed(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent({
    content: { parts: [{ text }], role: "user" },
    taskType: "RETRIEVAL_DOCUMENT" as any,
  });
  return result.embedding.values;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    const vec = await embed(text);
    results.push(vec);
  }
  return results;
}
