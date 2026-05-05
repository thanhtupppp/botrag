import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { z } from "zod";
import { createSupabaseServerClient, createServiceClient } from "@/lib/supabase/server";
import { retrieveTopKChunks } from "@/lib/rag/retrieve";
import { buildRagPrompt } from "@/lib/rag/prompt";

const RequestSchema = z.object({
  question: z.string().min(1).max(2000),
  sessionId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse + validate body
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { question, sessionId } = parsed.data;

    // 3. Retrieval
    const start = Date.now();
    const chunks = await retrieveTopKChunks(question, {
      k: 5,
      ownerId: user.id,
      minSimilarity: 0.3,
    });
    const latencyMs = Date.now() - start;

    // 4. Log retrieval (fire-and-forget)
    const serviceClient = createServiceClient();
    serviceClient
      .from("retrieval_logs")
      .insert({
        session_id: sessionId ?? null,
        owner_id: user.id,
        query: question,
        top_k: chunks.map((c) => ({ id: c.id, score: c.score })),
        latency_ms: latencyMs,
      })
      .then(({ error }) => {
        if (error) console.warn("[retrieval_log] insert error:", error.message);
      });

    // 5. Build prompt
    const prompt = buildRagPrompt(question, chunks);

    // 6. Stream response via Gemini
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
    });

    const citations = chunks.map((c, i) => ({
      index: i + 1,
      documentId: c.documentId,
      score: Math.round(c.score * 100) / 100,
      preview: c.content.slice(0, 120),
      metadata: c.metadata,
    }));

    const result = streamText({
      model: google("gemini-2.0-flash"),
      prompt,
      maxTokens: 1024,
      temperature: 0.2,
      onFinish: async ({ text }) => {
        // Persist messages if sessionId provided
        if (!sessionId) return;
        const msgs = [
          { session_id: sessionId, role: "user", content: question },
          { session_id: sessionId, role: "assistant", content: text },
        ];
        const { error } = await serviceClient.from("chat_messages").insert(msgs);
        if (error) console.warn("[chat_messages] insert error:", error.message);
      },
    });

    // 7. Return streaming response + citations header
    const response = result.toDataStreamResponse();
    const headers = new Headers(response.headers);
    headers.set("x-rag-citations", JSON.stringify(citations));
    headers.set("x-rag-chunks-found", String(chunks.length));

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (err) {
    console.error("[chat] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
