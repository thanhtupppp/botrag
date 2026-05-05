import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/observability";
import { checkRateLimit } from "@/lib/rate-limit";

type ChunkDetailResponse = {
  id: string;
  documentId: string;
  documentTitle: string | null;
  sourceName: string | null;
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const startedAt = performance.now();
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logEvent(
        "api.chunks.unauthorized",
        { route: "chunks", status: 401 },
        "warn",
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = req.headers.get("x-forwarded-for");
    const { allowed, remaining, resetAt } = await checkRateLimit(
      "chunks",
      user.id,
      ip,
    );

    if (!allowed) {
      logEvent(
        "api.chunks.rate_limited",
        {
          route: "chunks",
          userId: user.id,
          remaining,
          resetAt,
        },
        "warn",
      );
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil((resetAt - Date.now()) / 1000).toString(),
          },
        },
      );
    }

    const chunkId = params.id;
    void req;

    const { data, error } = await supabase
      .from("document_chunks")
      .select(
        `
        id,
        document_id,
        chunk_index,
        content,
        metadata,
        created_at,
        document:documents (
          id,
          title,
          source_name
        )
      `,
      )
      .eq("id", chunkId)
      .single();

    if (error || !data) {
      logEvent(
        "api.chunks.not_found",
        {
          route: "chunks",
          userId: user.id,
          chunkId,
        },
        "warn",
      );
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const payload: ChunkDetailResponse = {
      id: data.id,
      documentId: data.document_id,
      documentTitle: data.document?.title ?? null,
      sourceName: data.document?.source_name ?? null,
      chunkIndex: data.chunk_index,
      content: data.content,
      metadata: data.metadata ?? {},
      createdAt: data.created_at,
    };

    logEvent("api.chunks.success", {
      route: "chunks",
      userId: user.id,
      chunkId,
      documentId: payload.documentId,
      durationMs: Math.round(performance.now() - startedAt),
    });

    return NextResponse.json(payload);
  } catch (err) {
    logEvent(
      "api.chunks.error",
      {
        route: "chunks",
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
