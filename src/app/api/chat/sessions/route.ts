import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listChatSessions } from "@/lib/chat/sessions";
import { logEvent } from "@/lib/observability";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logEvent(
        "api.chat.sessions.unauthorized",
        { route: "chat.sessions" },
        "warn",
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    void req;
    const sessions = await listChatSessions(user.id);

    return NextResponse.json({
      sessions: sessions.map((session) => ({
        id: session.id,
        title: session.title,
        createdAt: session.created_at,
      })),
    });
  } catch (err) {
    logEvent(
      "api.chat.sessions.error",
      {
        route: "chat.sessions",
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
