"use client";

import { useMemo, useState } from "react";

type UploadState = "idle" | "uploading" | "success" | "error";

type UploadResponse = {
  error?: string;
  message?: string;
  documentId?: string;
  chunksInserted?: number;
};

const ACCEPTED_EXTENSIONS = [".docx", ".pdf", ".txt", ".md"] as const;

export function Uploader() {
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [chunksInserted, setChunksInserted] = useState<number | null>(null);

  const statusLabel = useMemo(() => {
    switch (state) {
      case "uploading":
        return "Đang upload và index...";
      case "success":
        return "Upload thành công";
      case "error":
        return "Upload thất bại";
      default:
        return "Sẵn sàng upload";
    }
  }, [state]);

  async function onSubmit(formData: FormData) {
    setState("uploading");
    setMessage("");
    setChunksInserted(null);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json().catch(() => ({}))) as UploadResponse;
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setState("success");
      setMessage(data.message || "Tài liệu đã được xử lý và index xong.");
      setChunksInserted(data.chunksInserted ?? null);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unknown error");
    }
  }

  return (
    <form
      action={async (formData) => {
        await onSubmit(formData);
      }}
      className="space-y-4"
    >
      <label className="block rounded-2xl border border-dashed border-white/20 bg-black/20 p-5 transition hover:border-violet-400/40 hover:bg-white/5">
        <span className="block text-sm font-medium text-white/80">
          Upload tài liệu
        </span>
        <span className="mt-1 block text-sm text-white/50">
          Hỗ trợ {ACCEPTED_EXTENSIONS.join(", ")}
        </span>
        <input
          className="mt-4 w-full text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-white hover:file:bg-violet-500"
          type="file"
          name="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            setFileName(file?.name || "");
            if (file && !documentTitle.trim()) {
              setDocumentTitle(file.name.replace(/\.[^.]+$/, ""));
            }
          }}
        />
      </label>

      <input
        name="title"
        value={documentTitle}
        onChange={(e) => setDocumentTitle(e.target.value)}
        placeholder="Tiêu đề tài liệu"
        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-violet-500/60"
      />

      <button
        type="submit"
        className="rounded-full bg-violet-600 px-5 py-3 text-sm font-medium transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={state === "uploading"}
      >
        {state === "uploading" ? "Đang upload..." : "Upload & index"}
      </button>

      <div className="space-y-2 text-sm text-white/70">
        <p className="text-white/50">{statusLabel}</p>
        {fileName ? <p>File: {fileName}</p> : null}
        {chunksInserted !== null ? <p>Chunks: {chunksInserted}</p> : null}
        {message ? (
          <p
            className={state === "error" ? "text-red-300" : "text-emerald-300"}
          >
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
