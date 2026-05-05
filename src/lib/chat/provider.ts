export interface ChatProvider {
  streamAnswer(prompt: string): AsyncGenerator<string>;
}

export const mockChatProvider: ChatProvider = {
  async *streamAnswer(prompt: string) {
    yield `Mock response for: ${prompt.slice(0, 120)}`;
  },
};
