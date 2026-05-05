import type { EmbeddingProvider } from "./provider";

export const googleEmbeddingProvider: EmbeddingProvider = {
  async embed(text: string) {
    void text;
    return [];
  },
};
