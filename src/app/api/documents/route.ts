import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteDocument, listDocuments } from "@/lib/rag/documents";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const documents = await listDocuments(user.id);
    return NextResponse.json({ documents });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load documents",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("id");

    if (!documentId) {
      return NextResponse.json(
        { error: "Missing document id" },
        { status: 400 },
      );
    }

    await deleteDocument(user.id, documentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete document",
      },
      { status: 500 },
    );
  }
}
