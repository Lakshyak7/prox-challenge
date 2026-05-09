import { useEffect, useRef } from "react";
import ChatMessage from "./ChatMessage";
import CitationsPanel from "@/components/layout/CitationsPanel";
import InlineArtifact from "./InlineArtifact";
import WeldContextPanel from "./WeldContextPanel";
import type { Message } from "@/components/AppShell";
import type { Citation } from "@/lib/types";
import type { Doc } from "@/components/manual/PdfViewer";
import type { WeldContext } from "./WeldContextPanel";

type Props = {
  messages: Message[];
  streaming: boolean;
  onSendFollowUp: (q: string) => void;
  citations?: Citation[];
  followUpQuestions?: string[];
  voiceReplies?: boolean;
  onOpenManualPage?: (doc: Doc, page: number) => void;
  weldContext?: WeldContext | null;
  onWeldContextChange?: (ctx: WeldContext | null) => void;
};

const EMPTY_PROMPTS = [
  "What polarity setup for TIG welding?",
  "Duty cycle for MIG at 200A on 240V?",
  "Getting porosity in flux-cored welds?",
  "Settings for 1/8\" mild steel?",
];

export default function ChatThread({ messages, streaming, onSendFollowUp, citations, followUpQuestions, voiceReplies, onOpenManualPage, weldContext, onWeldContextChange }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const hasRightPanel = !!(citations?.length || followUpQuestions?.length || onWeldContextChange);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Message list */}
      <div data-tour="chat-thread" className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-8 text-center">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-amber-400 text-2xl">⚡</span>
              </div>
              <h2 className="text-zinc-200 font-medium mb-1">Ask anything about your welder</h2>
              <p className="text-sm text-zinc-600">Grounded answers from the OmniPro 220 manual.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-w-sm w-full">
              {EMPTY_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => onSendFollowUp(p)}
                  className="text-left text-xs text-zinc-400 bg-zinc-900 hover:bg-zinc-800 border border-white/5 rounded-xl px-3 py-2.5 transition leading-snug"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5 max-w-2xl mx-auto">
            {messages.map((msg, i) => {
              const artifact = msg.metadata?.artifact;
              // guided-session stays inline; all other artifacts go to the left panel
              const showInline = artifact?.type === "guided-session";
              const hasPanel = artifact && artifact.type !== "guided-session";
              return (
                <div key={i} className="flex flex-col gap-0">
                  <ChatMessage
                    role={msg.role}
                    content={msg.content}
                    metadata={msg.metadata}
                    imagePreview={msg.imagePreview}
                    isStreaming={streaming && i === messages.length - 1 && msg.role === "assistant"}
                    onOpenManualPage={onOpenManualPage}
                  />
                  {showInline && artifact.type === "guided-session" && (
                    <InlineArtifact
                      artifact={artifact}
                      onAskFollowUp={onSendFollowUp}
                      voiceReplies={voiceReplies}
                      onOpenManualPage={onOpenManualPage}
                    />
                  )}
                  {/* Badge when artifact is in the left panel */}
                  {hasPanel && msg.role === "assistant" && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-[10px] text-zinc-600 uppercase tracking-wide">
                        {artifact.type === "manual-page-viewer" ? "📄 Pages" : "⚡ Artifact"} shown on left
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Right panel — weld context + citations + follow-ups */}
      {hasRightPanel && (
        <aside className="w-64 shrink-0 border-l border-white/5 bg-[#111114] flex flex-col">
          {/* Weld context — always shown when handler provided */}
          {onWeldContextChange && (
            <WeldContextPanel value={weldContext ?? null} onChange={onWeldContextChange} />
          )}

          {/* Citations + follow-ups — only when present */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {citations?.length ? <CitationsPanel citations={citations} onOpenManualPage={onOpenManualPage} /> : null}
            {followUpQuestions?.length ? (
              <div>
                <h4 className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">Follow-up</h4>
                <div className="flex flex-col gap-1">
                  {followUpQuestions.map((q) => (
                    <button key={q} onClick={() => onSendFollowUp(q)}
                      className="text-left text-xs text-zinc-400 hover:text-zinc-200 py-1.5 border-b border-white/5 last:border-0 transition">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      )}
    </div>
  );
}
