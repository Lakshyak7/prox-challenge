"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Header from "@/components/layout/Header";
import ChatThread from "@/components/chat/ChatThread";
import Canvas from "@/components/canvas/Canvas";
import ChatInput from "@/components/chat/ChatInput";
import ArtifactPanel from "@/components/layout/ArtifactPanel";
import ResizableSplit from "@/components/layout/ResizableSplit";
import type { AgentResponse, StreamEvent, PipelineMessage, AgentArtifact, SupportMode } from "@/lib/types";
import type { ManualTarget, Doc } from "@/components/manual/PdfViewer";
import Onboarding from "@/components/onboarding/Onboarding";

const ManualView = dynamic(() => import("@/components/manual/ManualView"), { ssr: false });

export type Message = {
  role: "user" | "assistant";
  content: string;
  metadata?: Omit<AgentResponse, "text">;
  imagePreview?: string;
};

export type ArtifactRecord = {
  artifact: AgentArtifact;
  question: string;
  source: AgentResponse["source"];
};

export type Tab = "chat" | "canvas" | "manual";

// Strip markdown so TTS reads cleanly
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[•·]\s*/g, "")
    .trim();
}

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content: "Hey! I'm your OmniPro 220 support assistant. To improve speed for context retrieval, can you tell me:\n\n• What issue or task are you working on?\n• What's your intended end goal?\n\nFor example: \"I'm setting up MIG welding for the first time on mild steel\" or \"My welds keep getting porosity and I need to fix it.\"\n\nThis helps me pre-load all the relevant steps, parts, and manual pages before you even ask your first question.",
};

export default function AppShell() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [mode, setMode] = useState<SupportMode>("using");
  const [voiceReplies, setVoiceReplies] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>(() =>
    typeof localStorage !== "undefined" ? (localStorage.getItem("omnipro-voice") ?? "") : ""
  );
  const [manualTarget, setManualTarget] = useState<ManualTarget | undefined>(undefined);
  const [weldContext, setWeldContext] = useState<import("@/components/chat/WeldContextPanel").WeldContext | null>(null);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    function loadVoices() {
      const all = window.speechSynthesis.getVoices();
      if (all.length) setVoices(all);
    }
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  const openManualPage = useCallback((doc: Doc, page: number) => {
    setManualTarget({ doc, page });
    setTab("manual");
  // setTab/setManualTarget are stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const streamingTextRef = useRef("");
  const sentenceBufferRef = useRef("");
  const streamingRef = useRef(false);          // synchronous flag for abort guard
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionId = useRef(
    typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  );

  // Keep a ref so the active stream always reads the latest voice name without recreating sendMessage
  const selectedVoiceNameRef = useRef(selectedVoiceName);
  useEffect(() => { selectedVoiceNameRef.current = selectedVoiceName; }, [selectedVoiceName]);

  // Stable speak helper — reads voice name from ref so it always uses the latest selection
  const speakChunk = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    const clean = stripMarkdown(text);
    if (!clean || clean.length < 5) return;
    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate = 0.96;
    const voiceName = selectedVoiceNameRef.current;
    if (voiceName) {
      const match = window.speechSynthesis.getVoices().find((v) => v.name === voiceName);
      if (match) utter.voice = match;
    }
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => {
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) setIsSpeaking(false);
    };
    utter.onerror = () => {
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) setIsSpeaking(false);
    };
    window.speechSynthesis.speak(utter);
  // setIsSpeaking is stable; selectedVoiceNameRef never changes identity — safe to omit both
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = useCallback(
    async (
      text: string,
      options: { voiceTranscript?: string; imageBase64?: string; imageMimeType?: string; imagePreview?: string } = {}
    ) => {
      if (streamingRef.current) return;

      // Cancel any speech still playing from the previous response
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);

      streamingRef.current = true;
      setStreaming(true);
      streamingTextRef.current = "";
      sentenceBufferRef.current = "";

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const userMsg: Message = { role: "user", content: text, imagePreview: options.imagePreview };
      setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);

      const history: PipelineMessage[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: text },
      ];

      const shouldSpeak = (voiceReplies || !!options.voiceTranscript) && "speechSynthesis" in window;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            mode,
            voiceTranscript: options.voiceTranscript,
            imageBase64: options.imageBase64,
            imageMimeType: options.imageMimeType,
            sessionId: sessionId.current,
            weldContext: weldContext ?? undefined,
          }),
          signal: controller.signal,
        });

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") break;
            try {
              const event = JSON.parse(payload) as StreamEvent;

              if (event.type === "text_replace") {
                streamingTextRef.current = event.text;
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last?.role === "assistant")
                    next[next.length - 1] = { ...last, content: event.text };
                  return next;
                });
              }

              if (event.type === "text") {
                streamingTextRef.current += event.chunk;
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last?.role === "assistant")
                    next[next.length - 1] = { ...last, content: last.content + event.chunk };
                  return next;
                });

                // ── Incremental TTS: speak each sentence as it arrives ──────
                if (shouldSpeak) {
                  sentenceBufferRef.current += event.chunk;
                  // Find first sentence boundary (period/!/? followed by whitespace)
                  const boundary = sentenceBufferRef.current.search(/[.!?]\s+/);
                  if (boundary !== -1) {
                    const sentence = sentenceBufferRef.current.slice(0, boundary + 1);
                    sentenceBufferRef.current = sentenceBufferRef.current.slice(boundary + 2);
                    speakChunk(sentence);
                  }
                }
              }

              if (event.type === "metadata") {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last?.role === "assistant")
                    next[next.length - 1] = { ...last, metadata: event.data };
                  return next;
                });

                if (event.data.artifact) {
                  const record: ArtifactRecord = {
                    artifact: event.data.artifact,
                    question: text,
                    source: event.data.source,
                  };
                  setArtifacts((prev) => [...prev, record]);
                }

                // Speak any remaining buffer at end of response
                if (shouldSpeak && sentenceBufferRef.current.trim().length > 4) {
                  speakChunk(sentenceBufferRef.current);
                  sentenceBufferRef.current = "";
                }
              }
            } catch {
              /* ignore parse errors */
            }
          }
        }
      } catch (err) {
        // AbortError is expected on barge-in — clean up silently
        if ((err as Error).name === "AbortError") return;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant")
            next[next.length - 1] = { ...last, content: `Error: ${String(err)}` };
          return next;
        });
      } finally {
        streamingRef.current = false;
        setStreaming(false);
      }
    },
    [messages, mode, voiceReplies, speakChunk]
  );

  // Stop current generation (keeps conversation history)
  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    sentenceBufferRef.current = "";
    setIsSpeaking(false);
    streamingRef.current = false;
    setStreaming(false);
  }, []);

  // Reset conversation entirely
  const resetConversation = useCallback(() => {
    stopGeneration();
    setMessages([WELCOME_MESSAGE]);
    setArtifacts([]);
    setTab("chat");
  }, [stopGeneration]);

  // Barge-in: user speaks while assistant is generating or speaking
  const handleBargeIn = useCallback(
    (transcript: string) => {
      abortControllerRef.current?.abort();
      window.speechSynthesis?.cancel();
      sentenceBufferRef.current = "";
      setIsSpeaking(false);
      // Sync flag reset so sendMessage isn't blocked
      streamingRef.current = false;
      setStreaming(false);
      // Wait one frame for React state to settle before re-entering sendMessage
      requestAnimationFrame(() => sendMessage(transcript, { voiceTranscript: transcript }));
    },
    [sendMessage]
  );

  const lastMeta = [...messages].reverse().find((m) => m.role === "assistant" && m.metadata)?.metadata;

  // Derive what goes in the left artifact panel
  const panelArtifact = useMemo((): AgentArtifact | null => {
    for (const msg of [...messages].reverse()) {
      if (msg.role !== "assistant" || !msg.metadata?.artifact) continue;
      const a = msg.metadata.artifact;
      // guided-session stays inline in chat; manual-page-viewer goes to pages panel
      if (a.type !== "guided-session" && a.type !== "manual-page-viewer") return a;
    }
    return null;
  }, [messages]);

  const panelPages = useMemo(() => {
    for (const msg of [...messages].reverse()) {
      if (msg.role !== "assistant" || !msg.metadata?.artifact) continue;
      const a = msg.metadata.artifact;
      if (a.type === "manual-page-viewer") return a.pages;
    }
    return [];
  }, [messages]);

  const hasPanelContent = panelArtifact !== null || panelPages.length > 0;

  return (
    <div className="h-full flex flex-col bg-[#0c0c0f]">
      <Onboarding onSwitchTab={setTab} />
      <Header
        tab={tab}
        mode={mode}
        voiceReplies={voiceReplies}
        voices={voices}
        selectedVoiceName={selectedVoiceName}
        onTabChange={setTab}
        onModeChange={setMode}
        onVoiceRepliesChange={setVoiceReplies}
        onVoiceChange={(name) => {
          setSelectedVoiceName(name);
          localStorage.setItem("omnipro-voice", name);
        }}
      />

      <div className="flex-1 overflow-hidden">
        {tab === "chat" && (
          <div className="h-full overflow-hidden">
            {hasPanelContent ? (
              <ResizableSplit
                defaultLeft={62}
                minLeft={20}
                maxLeft={62}
                collapsible="left"
                collapsedLabel="Artifact"
                collapsedIcon="⚡"
                storageKey="artifact-panel"
                left={
                  <ArtifactPanel
                    artifact={panelArtifact}
                    pages={panelPages}
                    onAskFollowUp={(q) => sendMessage(q)}
                    onOpenManualPage={openManualPage}
                  />
                }
                right={
                  <div className="flex flex-col h-full overflow-hidden">
                    <ChatThread
                      messages={messages}
                      streaming={streaming}
                      onSendFollowUp={(q) => sendMessage(q)}
                      citations={lastMeta?.citations}
                      followUpQuestions={lastMeta?.followUpQuestions}
                      voiceReplies={voiceReplies}
                      onOpenManualPage={openManualPage}
                      weldContext={weldContext}
                      onWeldContextChange={setWeldContext}
                    />
                    <ChatInput
                      onSend={sendMessage}
                      disabled={streaming}
                      mode={mode}
                      voiceReplies={voiceReplies}
                      isSpeaking={isSpeaking}
                      isGenerating={streaming}
                      onBargeIn={handleBargeIn}
                      onStop={stopGeneration}
                      onNewChat={resetConversation}
                    />
                  </div>
                }
              />
            ) : (
              <div className="flex flex-col h-full overflow-hidden">
                <ChatThread
                  messages={messages}
                  streaming={streaming}
                  onSendFollowUp={(q) => sendMessage(q)}
                  citations={lastMeta?.citations}
                  followUpQuestions={lastMeta?.followUpQuestions}
                  voiceReplies={voiceReplies}
                  onOpenManualPage={openManualPage}
                  weldContext={weldContext}
                  onWeldContextChange={setWeldContext}
                />
                <ChatInput
                  onSend={sendMessage}
                  disabled={streaming}
                  mode={mode}
                  voiceReplies={voiceReplies}
                  isSpeaking={isSpeaking}
                  isGenerating={streaming}
                  onBargeIn={handleBargeIn}
                  onStop={stopGeneration}
                  onNewChat={resetConversation}
                />
              </div>
            )}
          </div>
        )}
        {tab === "canvas" && (
          <Canvas artifacts={artifacts} onAskFollowUp={(q) => { setTab("chat"); sendMessage(q); }} />
        )}
        {tab === "manual" && (
          <ManualView
            messages={messages}
            streaming={streaming}
            onSend={sendMessage}
            isSpeaking={isSpeaking}
            isGenerating={streaming}
            onBargeIn={handleBargeIn}
            voiceReplies={voiceReplies}
            mode={mode}
            citations={lastMeta?.citations}
            followUpQuestions={lastMeta?.followUpQuestions}
            navigateTo={manualTarget}
            onOpenManualPage={openManualPage}
            onStop={stopGeneration}
            onNewChat={resetConversation}
          />
        )}
      </div>

      {/* Canvas tab still has its own input */}
      {tab === "canvas" && (
        <ChatInput
          onSend={(q) => { setTab("chat"); sendMessage(q); }}
          disabled={streaming}
          mode={mode}
          voiceReplies={voiceReplies}
          isSpeaking={isSpeaking}
          isGenerating={streaming}
          onBargeIn={handleBargeIn}
          onStop={stopGeneration}
          onNewChat={resetConversation}
        />
      )}
    </div>
  );
}
