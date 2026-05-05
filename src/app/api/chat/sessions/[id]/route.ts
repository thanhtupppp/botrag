import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getChatSession, renameChatSession } from "@/lib/chat/sessions";
import { logEvent } from "@/lib/observability";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logEvent(
        "api.chat.sessions.detail.unauthorized",
        { route: "chat.sessions.detail" },
        "warn",
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { session, messages } = await getChatSession(user.id, id);
    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        createdAt: session.created_at,
      },
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
      })),
    });
  } catch (err) {
    logEvent(
      "api.chat.sessions.detail.error",
      {
        route: "chat.sessions.detail",
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logEvent(
        "api.chat.sessions.rename.unauthorized",
        { route: "chat.sessions.rename" },
        "warn",
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const session = await renameChatSession(user.id, id, title);
    return NextResponse.json({
      ok: true,
      session: {
        id: session.id,
        title: session.title,
        createdAt: session.created_at,
      },
    });
  } catch (err) {
    logEvent(
      "api.chat.sessions.rename.error",
      {
        route: "chat.sessions.rename",
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
