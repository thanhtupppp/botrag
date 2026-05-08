"use client";

import { useEffect, useState } from "react";

type DocumentRow = {
  id: string;
  title: string;
  source_name: string | null;
  mime_type: string | null;
  status: string;
  created_at: string;
};

type Props = {
  onDocumentsLoaded?: (count: number) => void;
};

export function DocumentLibrary({ onDocumentsLoaded }: Props) {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadDocuments() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/documents");
      if (!res.ok) throw new Error("Failed to load documents");
      const data = (await res.json()) as { documents: DocumentRow[] };
      setDocuments(data.documents);
      onDocumentsLoaded?.(data.documents.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(documentId: string) {
    setDeletingId(documentId);
    try {
      const res = await fetch(`/api/documents?id=${documentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete document");
      await loadDocuments();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete document",
      );
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, []);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">
            Documents
          </p>
          <h2 className="mt-3 text-2xl font-semibold">Tài liệu đã upload</h2>
        </div>
        <button
          onClick={() => void loadDocuments()}
          className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? <p className="text-sm text-white/50">Đang tải...</p> : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {!loading && documents.length === 0 ? (
          <p className="text-sm text-white/50">Chưa có tài liệu nào.</p>
        ) : null}
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div>
              <p className="font-medium text-white">{doc.title}</p>
              <p className="text-xs text-white/50">
                {doc.source_name ?? "Unknown file"} · {doc.mime_type ?? "-"} ·{" "}
                {doc.status}
              </p>
            </div>
            <button
              onClick={() => void handleDelete(doc.id)}
              disabled={deletingId === doc.id}
              className="rounded-full bg-red-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletingId === doc.id ? "Deleting..." : "Delete"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
