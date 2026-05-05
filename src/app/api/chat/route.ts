import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { z } from "zod";
import {
  createSupabaseServerClient,
  createServiceClient,
} from "@/lib/supabase/server";
import { retrieveTopKChunks } from "@/lib/rag/retrieve";
import { buildRagPrompt } from "@/lib/rag/prompt";
import { checkRateLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/observability";

const RequestSchema = z.object({
  question: z.string().min(1).max(2000),
  sessionId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const requestStartedAt = performance.now();

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      logEvent("api.chat.unauthorized", { route: "chat", status: 401 }, "warn");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = req.headers.get("x-forwarded-for");
    const rateLimit = await checkRateLimit("chat", user.id, ip);
    if (!rateLimit.allowed) {
      logEvent(
        "api.chat.rate_limited",
        {
          route: "chat",
          userId: user.id,
          remaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt,
        },
        "warn",
      );
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(
              (rateLimit.resetAt - Date.now()) / 1000,
            ).toString(),
          },
        },
      );
    }

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      logEvent("api.chat.invalid_request", { route: "chat" }, "warn");
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { question, sessionId } = parsed.data;

    const retrievalStartedAt = performance.now();
    const chunks = await retrieveTopKChunks(question, {
      k: 5,
      ownerId: user.id,
      minSimilarity: 0.3,
    });
    const retrievalLatencyMs = Math.round(
      performance.now() - retrievalStartedAt,
    );

    const serviceClient = createServiceClient();
    serviceClient
      .from("retrieval_logs")
      .insert({
        session_id: sessionId ?? null,
        owner_id: user.id,
        query: question,
        top_k: chunks.map((c) => ({ id: c.id, score: c.score })),
        latency_ms: retrievalLatencyMs,
      })
      .then(({ error }) => {
        if (error) console.warn("[retrieval_log] insert error:", error.message);
      });

    logEvent("api.chat.retrieval", {
      route: "chat",
      userId: user.id,
      sessionId,
      chunksFound: chunks.length,
      retrievalLatencyMs,
    });

    const prompt = buildRagPrompt(question, chunks);
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
    });

    const citations = chunks.map((c, i) => ({
      index: i + 1,
      chunkId: c.id,
      documentId: c.documentId,
      score: Math.round(c.score * 100) / 100,
      preview: c.content.slice(0, 160),
      metadata: c.metadata,
    }));

    const generationStartedAt = performance.now();
    const result = streamText({
      model: google("gemini-2.5-flash"),
      prompt,
      maxTokens: 1024,
      temperature: 0.2,
      onFinish: async ({ text }) => {
        if (!sessionId) return;
        const msgs = [
          { session_id: sessionId, role: "user", content: question },
          { session_id: sessionId, role: "assistant", content: text },
        ];
        const { error } = await serviceClient
          .from("chat_messages")
          .insert(msgs);
        if (error) console.warn("[chat_messages] insert error:", error.message);
        logEvent("api.chat.finish", {
          route: "chat",
          userId: user.id,
          sessionId,
          chunksFound: chunks.length,
          retrievalLatencyMs,
          generationLatencyMs: Math.round(
            performance.now() - generationStartedAt,
          ),
          totalLatencyMs: Math.round(performance.now() - requestStartedAt),
        });
      },
    });

    const response = result.toDataStreamResponse();
    const headers = new Headers(response.headers);
    headers.set("x-rag-citations", JSON.stringify(citations));
    headers.set("x-rag-chunks-found", String(chunks.length));

    logEvent("api.chat.started", {
      route: "chat",
      userId: user.id,
      sessionId,
      chunksFound: chunks.length,
      retrievalLatencyMs,
      totalLatencyMs: Math.round(performance.now() - requestStartedAt),
    });

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (err) {
    logEvent(
      "api.chat.error",
      {
        route: "chat",
        error: String(err instanceof Error ? err.message : err),
      },
      "error",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
