import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseFileToText, MIME_BY_EXT, isSupportedMime } from "@/lib/rag/parse";
import { ingestText } from "@/lib/rag/ingest";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string | null) ?? "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
    }

    // 3. Resolve MIME
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mimeType = MIME_BY_EXT[ext] ?? file.type;
    if (!isSupportedMime(mimeType)) {
      return NextResponse.json(
        { error: `Unsupported file type: .${ext}` },
        { status: 400 }
      );
    }

    // 4. Parse to text
    const buffer = await file.arrayBuffer();
    const text = await parseFileToText(buffer, mimeType);

    if (!text.trim()) {
      return NextResponse.json(
        { error: "File has no extractable text" },
        { status: 422 }
      );
    }

    // 5. Ingest
    const result = await ingestText(text, {
      ownerId: user.id,
      title: title || file.name,
      sourceName: file.name,
      mimeType,
    });

    return NextResponse.json({
      ok: true,
      documentId: result.documentId,
      chunksInserted: result.chunksInserted,
    });
  } catch (err) {
    console.error("[upload] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
