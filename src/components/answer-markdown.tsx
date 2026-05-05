"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { UICitation } from "@/app/chat/types";

type Props = {
  text: string;
  citations: UICitation[];
  onCitationHover?: (index: number | null) => void;
  onCitationClick?: (index: number) => void;
};

function tokenizeWithCitations(raw: string) {
  const parts: Array<{ type: "text" | "cite"; value: string; index?: number }> =
    [];
  const regex = /\[#(\d+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: raw.slice(lastIndex, match.index) });
    }

    parts.push({ type: "cite", value: match[0], index: Number(match[1]) });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < raw.length) {
    parts.push({ type: "text", value: raw.slice(lastIndex) });
  }

  return parts;
}

export function AnswerMarkdown({
  text,
  citations,
  onCitationHover,
  onCitationClick,
}: Props) {
  const parts = tokenizeWithCitations(text);

  return (
    <div className="prose prose-sm prose-invert max-w-none prose-p:leading-7 prose-li:leading-7 prose-headings:scroll-m-20">
      {parts.map((part, i) => {
        if (part.type === "text") {
          return (
            <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
              {part.value}
            </ReactMarkdown>
          );
        }

        const citation = citations.find((c) => c.index === part.index);
        if (!citation) {
          return (
            <span
              key={i}
              className="mx-0.5 inline-flex rounded-full border border-white/10 bg-white/5 px-1.5 text-[11px] font-medium text-white/60"
            >
              #{part.index}
            </span>
          );
        }

        return (
          <button
            key={i}
            type="button"
            onMouseEnter={() => onCitationHover?.(citation.index)}
            onMouseLeave={() => onCitationHover?.(null)}
            onClick={() => onCitationClick?.(citation.index)}
            className="mx-0.5 inline-flex items-center rounded-full border border-violet-400/30 bg-violet-500/10 px-1.5 text-[11px] font-medium text-violet-200 transition hover:bg-violet-500/20"
          >
            #{citation.index}
          </button>
        );
      })}
    </div>
  );
}
