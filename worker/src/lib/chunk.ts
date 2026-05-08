// Copied from src/lib/rag/chunk.ts — standalone for worker (no Next.js deps)

export interface TextChunk {
  content: string;
  chunkIndex: number;
  metadata: {
    headings: string[];
    charStart: number;
    charEnd: number;
  };
}

const HEADING_RE = /^#{1,6}\s+.+$/m;
const MAX_CHUNK_CHARS = 800;
const OVERLAP_CHARS = 120;

export function chunkText(text: string): TextChunk[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];

  const sections = splitBySections(normalized);
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const paragraphs = section.content.split("\n\n").filter((p) => p.trim());
    let buffer = "";
    let bufferStart = section.charStart;

    for (const para of paragraphs) {
      const candidate = buffer ? `${buffer}\n\n${para}` : para;
      if (candidate.length <= MAX_CHUNK_CHARS) {
        buffer = candidate;
      } else {
        if (buffer) {
          const end = bufferStart + buffer.length;
          chunks.push({
            content: buffer.trim(),
            chunkIndex: chunkIndex++,
            metadata: { headings: section.headings, charStart: bufferStart, charEnd: end },
          });
          bufferStart = Math.max(end - OVERLAP_CHARS, bufferStart);
        }
        if (para.length > MAX_CHUNK_CHARS) {
          const subChunks = slidingWindow(para, bufferStart);
          for (const sc of subChunks) {
            chunks.push({ ...sc, chunkIndex: chunkIndex++, metadata: { ...sc.metadata, headings: section.headings } });
          }
          bufferStart += para.length;
          buffer = "";
        } else {
          buffer = para;
        }
      }
    }
    if (buffer.trim()) {
      chunks.push({
        content: buffer.trim(),
        chunkIndex: chunkIndex++,
        metadata: { headings: section.headings, charStart: bufferStart, charEnd: bufferStart + buffer.length },
      });
    }
  }
  return chunks;
}

interface Section {
  headings: string[];
  content: string;
  charStart: number;
}

function splitBySections(text: string): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];
  let currentHeadings: string[] = [];
  let currentLines: string[] = [];
  let charCursor = 0;
  let sectionStart = 0;

  for (const line of lines) {
    if (HEADING_RE.test(line)) {
      if (currentLines.join("\n").trim()) {
        sections.push({ headings: [...currentHeadings], content: currentLines.join("\n"), charStart: sectionStart });
      }
      currentHeadings = [...currentHeadings.slice(0, 1), line.replace(/^#+\s+/, "").trim()];
      sectionStart = charCursor;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
    charCursor += line.length + 1;
  }
  if (currentLines.join("\n").trim()) {
    sections.push({ headings: currentHeadings, content: currentLines.join("\n"), charStart: sectionStart });
  }
  if (sections.length === 0) {
    sections.push({ headings: [], content: text, charStart: 0 });
  }
  return sections;
}

function slidingWindow(text: string, baseOffset: number): Omit<TextChunk, "chunkIndex">[] {
  const results: Omit<TextChunk, "chunkIndex">[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + MAX_CHUNK_CHARS, text.length);
    results.push({
      content: text.slice(start, end).trim(),
      metadata: { headings: [], charStart: baseOffset + start, charEnd: baseOffset + end },
    });
    if (end === text.length) break;
    start = Math.max(end - OVERLAP_CHARS, start + 1);
  }
  return results;
}
