import { createServiceClient } from "@/lib/supabase/server";

export type DocumentRow = {
  id: string;
  owner_id: string;
  title: string;
  source_name: string | null;
  mime_type: string | null;
  status: string;
  created_at: string;
};

export async function listDocuments(ownerId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, owner_id, title, source_name, mime_type, status, created_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentRow[];
}

export async function deleteDocument(ownerId: string, documentId: string) {
  const supabase = createServiceClient();

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("owner_id", ownerId)
    .single();

  if (docError || !doc) {
    throw new Error(docError?.message ?? "Document not found");
  }

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("owner_id", ownerId);

  if (error) throw new Error(error.message);

  return { ok: true };
}
