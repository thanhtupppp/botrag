// Copied from src/lib/rag/parse.ts — standalone for worker (no Next.js deps)

export type SupportedMime =
  | "text/plain"
  | "text/markdown"
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const SUPPORTED_MIMES: SupportedMime[] = [
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const MIME_BY_EXT: Record<string, SupportedMime> = {
  txt: "text/plain",
  md: "text/markdown",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function isSupportedMime(mime: string): mime is SupportedMime {
  return (SUPPORTED_MIMES as string[]).includes(mime);
}

export async function parseFileToText(
  buffer: ArrayBuffer,
  mimeType: SupportedMime
): Promise<string> {
  switch (mimeType) {
    case "text/plain":
    case "text/markdown": {
      return new TextDecoder("utf-8").decode(buffer);
    }
    case "application/pdf": {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(Buffer.from(buffer));
      return data.text;
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const mammoth = (await import("mammoth")).default;
      const result = await mammoth.extractRawText({
        buffer: Buffer.from(buffer),
      });
      return result.value;
    }
    default:
      throw new Error(`Unsupported mime type: ${mimeType}`);
  }
}
