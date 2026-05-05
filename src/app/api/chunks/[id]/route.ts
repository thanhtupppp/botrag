import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[chunks/:id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
