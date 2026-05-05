import {
  createServiceClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

export type ChatSessionRow = {
  id: string;
  owner_id: string;
  title: string | null;
  created_at: string;
};

export type ChatMessageRow = {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
};

export async function listChatSessions(ownerId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("id, owner_id, title, created_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ChatSessionRow[];
}

export async function getChatSession(ownerId: string, sessionId: string) {
  const supabase = createServiceClient();

  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("id, owner_id, title, created_at")
    .eq("id", sessionId)
    .eq("owner_id", ownerId)
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message ?? "Session not found");
  }

  const { data: messages, error: messagesError } = await supabase
    .from("chat_messages")
    .select("id, session_id, role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (messagesError) throw new Error(messagesError.message);

  return {
    session: session as ChatSessionRow,
    messages: (messages ?? []) as ChatMessageRow[],
  };
}

export async function createChatSession(
  ownerId: string,
  title: string | null = null,
) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ owner_id: ownerId, title })
    .select("id, owner_id, title, created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create session");
  }

  return data as ChatSessionRow;
}

export async function renameChatSession(
  ownerId: string,
  sessionId: string,
  title: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("owner_id", ownerId)
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message ?? "Session not found");
  }

  const { data, error } = await supabase
    .from("chat_sessions")
    .update({ title })
    .eq("id", sessionId)
    .select("id, owner_id, title, created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to rename session");
  }

  return data as ChatSessionRow;
}
