import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseFileToText, MIME_BY_EXT, isSupportedMime } from "@/lib/rag/parse";
import { ingestText } from "@/lib/rag/ingest";
import { checkRateLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/observability";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(req: NextRequest) {
  const requestStartedAt = performance.now();

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      logEvent("api.upload.unauthorized", { route: "upload" }, "warn");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = req.headers.get("x-forwarded-for");
    const rateLimit = await checkRateLimit("upload", user.id, ip);
    if (!rateLimit.allowed) {
      logEvent(
        "api.upload.rate_limited",
        {
          route: "upload",
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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string | null) ?? "";

    if (!file) {
      logEvent(
        "api.upload.invalid_request",
        { route: "upload", reason: "no_file" },
        "warn",
      );
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      logEvent(
        "api.upload.invalid_request",
        { route: "upload", reason: "file_too_large", fileSize: file.size },
        "warn",
      );
      return NextResponse.json(
        { error: "File too large (max 20MB)" },
        { status: 400 },
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mimeType = MIME_BY_EXT[ext] ?? file.type;
    if (!isSupportedMime(mimeType)) {
      logEvent(
        "api.upload.invalid_request",
        { route: "upload", reason: "unsupported_mime", mimeType, ext },
        "warn",
      );
      return NextResponse.json(
        { error: `Unsupported file type: .${ext}` },
        { status: 400 },
      );
    }

    const buffer = await file.arrayBuffer();
    const text = await parseFileToText(buffer, mimeType);

    if (!text.trim()) {
      logEvent(
        "api.upload.invalid_request",
        {
          route: "upload",
          reason: "no_extractable_text",
          mimeType,
          fileSize: file.size,
        },
        "warn",
      );
      return NextResponse.json(
        { error: "File has no extractable text" },
        { status: 422 },
      );
    }

    const result = await ingestText(text, {
      ownerId: user.id,
      title: title || file.name,
      sourceName: file.name,
      mimeType,
    });

    logEvent("api.upload.success", {
      route: "upload",
      userId: user.id,
      fileName: file.name,
      fileSize: file.size,
      mimeType,
      documentId: result.documentId,
      chunksInserted: result.chunksInserted,
      totalLatencyMs: Math.round(performance.now() - requestStartedAt),
    });

    return NextResponse.json({
      ok: true,
      documentId: result.documentId,
      chunksInserted: result.chunksInserted,
    });
  } catch (err) {
    logEvent(
      "api.upload.error",
      {
        route: "upload",
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
