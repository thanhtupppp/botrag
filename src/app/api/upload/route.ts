import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MIME_BY_EXT, isSupportedMime } from "@/lib/rag/parse";
import { checkRateLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/observability";
import { createClient } from "@supabase/supabase-js";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const WORKER_URL = process.env.INGEST_WORKER_URL ?? "http://localhost:3001";
const WORKER_SECRET = process.env.INGEST_WORKER_SECRET ?? "";

async function uploadToSupabase(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  file: File,
  userId: string
) {
  const fileName = `${userId}/${Date.now()}-${file.name}`;
  const buffer = await file.arrayBuffer();
  const { data, error } = await supabase.storage
    .from("documents")
    .upload(fileName, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw new Error(error.message);
  return data.path;
}

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
        "warn"
      );
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(
              (rateLimit.resetAt - Date.now()) / 1000
            ).toString(),
          },
        }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string | null) ?? "";

    if (!file) {
      logEvent(
        "api.upload.invalid_request",
        { route: "upload", reason: "no_file" },
        "warn"
      );
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      logEvent(
        "api.upload.invalid_request",
        { route: "upload", reason: "file_too_large", fileSize: file.size },
        "warn"
      );
      return NextResponse.json(
        { error: "File too large (max 20MB)" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mimeType = MIME_BY_EXT[ext] ?? file.type;
    if (!isSupportedMime(mimeType)) {
      logEvent(
        "api.upload.invalid_request",
        { route: "upload", reason: "unsupported_mime", mimeType, ext },
        "warn"
      );
      return NextResponse.json(
        { error: `Unsupported file type: .${ext}` },
        { status: 400 }
      );
    }

    // 1) Upload file to Supabase Storage
    await uploadToSupabase(supabase, file, user.id);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Missing SUPABASE env" },
        { status: 500 }
      );
    }

    // 2) Create a document row in documents table
    const supabaseAdmin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: docRow, error: docErr } = await supabaseAdmin
      .from("documents")
      .insert({
        title: title || file.name,
        mime_type: mimeType,
        status: "processing",
        owner_id: user.id,
      })
      .select("id")
      .single();

    if (docErr || !docRow) {
      logEvent("api.upload.error", { route: "upload", error: docErr?.message }, "error");
      return NextResponse.json(
        { error: "Failed to create document record" },
        { status: 500 }
      );
    }

    const documentId = docRow.id;
    const totalLatencyMs = Math.round(performance.now() - requestStartedAt);

    // 3) Fire-and-forget to worker (do NOT await)
    const buffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(buffer).toString("base64");

    fetch(`${WORKER_URL}/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": WORKER_SECRET,
      },
      body: JSON.stringify({
        fileBase64: fileBuffer,
        mimeType,
        documentId,
        ownerId: user.id,
      }),
    }).catch((err) => {
      logEvent("api.upload.worker_error", { route: "upload", error: String(err) }, "warn");
    });

    logEvent("api.upload.success", {
      route: "upload",
      userId: user.id,
      fileName: file.name,
      fileSize: file.size,
      mimeType,
      documentId,
      totalLatencyMs,
      processing: "async-worker",
    });

    return NextResponse.json({
      ok: true,
      documentId,
      processing: "async",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logEvent("api.upload.error", { route: "upload", error: message }, "error");
    return NextResponse.json(
      { error: message || "Internal server error" },
      { status: 500 }
    );
  }
}
