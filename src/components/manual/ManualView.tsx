"use client";

import dynamic from "next/dynamic";
import ChatThread from "@/components/chat/ChatThread";
import ChatInput from "@/components/chat/ChatInput";
import ResizableSplit from "@/components/layout/ResizableSplit";
import type { Message } from "@/components/AppShell";
import type { SupportMode, AgentResponse } from "@/lib/types";
import type { ManualTarget, Doc } from "@/components/manual/PdfViewer";

const PdfViewer = dynamic(() => import("@/components/manual/PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-[#0a0a0d]">
      <div className="w-6 h-6 rounded-full border-2 border-zinc-700 border-t-amber-400 animate-spin" />
    </div>
  ),
});

type SendOptions = {
  voiceTranscript?: string;
  imageBase64?: string;
  imageMimeType?: string;
  imagePreview?: string;
};

type Props = {
  messages: Message[];
  streaming: boolean;
  onSend: (text: string, options?: SendOptions) => void;
  isSpeaking: boolean;
  isGenerating: boolean;
  onBargeIn: (transcript: string) => void;
  voiceReplies: boolean;
  mode: SupportMode;
  citations?: AgentResponse["citations"];
  followUpQuestions?: string[];
  navigateTo?: ManualTarget;
  onOpenManualPage?: (doc: Doc, page: number) => void;
  onStop?: () => void;
  onNewChat?: () => void;
};

export default function ManualView({
  messages, streaming, onSend, isSpeaking, isGenerating,
  onBargeIn, voiceReplies, mode, citations, followUpQuestions,
  navigateTo, onOpenManualPage, onStop, onNewChat,
}: Props) {
  return (
    <div className="h-full overflow-hidden">
      <ResizableSplit
        defaultLeft={65}
        minLeft={35}
        maxLeft={80}
        collapsible="right"
        collapsedLabel="Chat"
        collapsedIcon="💬"
        storageKey="manual-chat"
        left={
          <div className="h-full border-r border-white/5">
            <PdfViewer navigateTo={navigateTo} />
          </div>
        }
        right={
          <div className="flex flex-col h-full bg-[#0c0c0f]">
            <ChatThread
              messages={messages}
              streaming={streaming}
              onSendFollowUp={(q) => onSend(q)}
              citations={citations}
              followUpQuestions={followUpQuestions}
              voiceReplies={voiceReplies}
              onOpenManualPage={onOpenManualPage}
            />
            <ChatInput
              onSend={onSend}
              disabled={streaming}
              mode={mode}
              voiceReplies={voiceReplies}
              isSpeaking={isSpeaking}
              isGenerating={isGenerating}
              onBargeIn={onBargeIn}
              onStop={onStop}
              onNewChat={onNewChat}
            />
          </div>
        }
      />
    </div>
  );
}
