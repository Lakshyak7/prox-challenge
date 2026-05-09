"use client";

import type { AgentResponse } from "@/lib/types";
import type { Doc } from "@/components/manual/PdfViewer";
import SourceBadge from "./SourceBadge";

type Props = {
  role: "user" | "assistant";
  content: string;
  metadata?: Omit<AgentResponse, "text">;
  imagePreview?: string;
  isStreaming?: boolean;
  onOpenManualPage?: (doc: Doc, page: number) => void;
};

// Regex: matches "p.24", "p. 24", "page 24" optionally preceded by doc name
const PAGE_REF_RE = /\b(?:p\.\s*|page\s+)(\d{1,3})\b/gi;

type Segment = string | { doc: Doc; page: number; label: string };

function parsePageRefs(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(PAGE_REF_RE.source, "gi");

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(text.slice(lastIndex, match.index));
    }

    const pageNum = parseInt(match[1], 10);
    // Peek at the 60 chars before to detect doc name
    const before = text.slice(Math.max(0, match.index - 60), match.index).toLowerCase();
    let doc: Doc = "owner-manual";
    if (/quick[\s-]*start/i.test(before)) doc = "quick-start-guide";
    else if (/selection[\s-]*chart/i.test(before)) doc = "selection-chart";

    segments.push({ doc, page: pageNum, label: match[0].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) segments.push(text.slice(lastIndex));
  return segments;
}

function MessageContent({
  text,
  isStreaming,
  onOpenManualPage,
}: {
  text: string;
  isStreaming?: boolean;
  onOpenManualPage?: (doc: Doc, page: number) => void;
}) {
  if (!onOpenManualPage) {
    return (
      <>
        {text || (isStreaming ? "" : "…")}
        {isStreaming && <TypingDots />}
      </>
    );
  }

  const segments = parsePageRefs(text);

  return (
    <>
      {segments.map((seg, i) =>
        typeof seg === "string" ? (
          <span key={i}>{seg || (i === 0 && isStreaming ? "" : undefined)}</span>
        ) : (
          <button
            key={i}
            onClick={() => onOpenManualPage(seg.doc, seg.page)}
            title={`Open ${seg.doc === "owner-manual" ? "Owner Manual" : seg.doc === "quick-start-guide" ? "Quick Start Guide" : "Selection Chart"} p.${seg.page}`}
            className="inline-flex items-center gap-0.5 text-amber-400 hover:text-amber-300 underline underline-offset-2 transition font-medium"
          >
            {seg.label}
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline -mt-0.5 opacity-70">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </button>
        )
      )}
      {isStreaming && <TypingDots />}
    </>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-0.5 ml-1.5 align-middle">
      <span className="w-1 h-1 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1 h-1 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1 h-1 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

export default function ChatMessage({ role, content, metadata, imagePreview, isStreaming, onOpenManualPage }: Props) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className={`w-6 h-6 rounded-full shrink-0 mt-0.5 flex items-center justify-center text-[10px] font-semibold ${
        isUser ? "bg-zinc-700 text-zinc-300" : "bg-amber-500/15 border border-amber-500/25 text-amber-400"
      }`}>
        {isUser ? "U" : "⚡"}
      </div>

      <div className={`flex flex-col gap-1.5 min-w-0 ${isUser ? "items-end" : "items-start"} max-w-[82%]`}>
        {/* Image preview */}
        {imagePreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagePreview} alt="attached" className="max-w-[200px] rounded-xl border border-white/10 mb-1" />
        )}

        {/* Message bubble */}
        <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? "bg-zinc-800 text-zinc-100 rounded-tr-sm"
            : "bg-[#1c1c22] border border-white/5 text-zinc-100 rounded-tl-sm"
        }`}>
          <MessageContent
            text={content}
            isStreaming={isStreaming}
            onOpenManualPage={isUser ? undefined : onOpenManualPage}
          />
        </div>

        {/* Source badge + confidence */}
        {metadata && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <SourceBadge source={metadata.source} label={metadata.sourceLabel} />
            {metadata.confidence === "low" && (
              <span className="text-[10px] text-red-400/80 font-medium">⚠ low confidence</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
