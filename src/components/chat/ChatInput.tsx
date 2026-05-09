"use client";

import { useState, useRef, KeyboardEvent } from "react";
import VoiceButton from "@/components/voice/VoiceButton";
import type { SupportMode } from "@/lib/types";

type SendOptions = {
  voiceTranscript?: string;
  imageBase64?: string;
  imageMimeType?: string;
  imagePreview?: string;
};

type Props = {
  onSend: (text: string, options?: SendOptions) => void;
  disabled?: boolean;
  mode: SupportMode;
  voiceReplies: boolean;
  isSpeaking?: boolean;
  isGenerating?: boolean;
  onBargeIn?: (transcript: string) => void;
  onStop?: () => void;
  onNewChat?: () => void;
};

const PLACEHOLDERS: Record<SupportMode, string> = {
  using: "Ask what to do while using the OmniPro 220…",
  setup: "Ask how to set up cables, gas, wire, or controls…",
  debugging: "Describe the symptom you are seeing…",
  testing: "Ask how to verify a setting or test weld…",
  fixing: "Ask what to inspect, clean, replace, or adjust…",
};

export default function ChatInput({ onSend, disabled, mode, voiceReplies, isSpeaking, isGenerating, onBargeIn, onStop, onNewChat }: Props) {
  const [value, setValue] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [voiceInfo, setVoiceInfo] = useState<{ active: boolean; listening: boolean }>({ active: false, listening: false });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSend() {
    const trimmed = value.trim();
    if ((!trimmed && !imageBase64) || disabled) return;
    onSend(trimmed || "What is this?", {
      imageBase64: imageBase64 ?? undefined,
      imageMimeType: imageMimeType ?? undefined,
      imagePreview: imagePreview ?? undefined,
    });
    setValue("");
    setImagePreview(null);
    setImageBase64(null);
    setImageMimeType(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const [meta, b64] = dataUrl.split(",");
      setImagePreview(dataUrl);
      setImageBase64(b64);
      setImageMimeType(meta.replace("data:", "").replace(";base64", ""));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleTranscript(transcript: string) {
    onSend(transcript, { voiceTranscript: transcript });
  }

  return (
    <div className="shrink-0 px-4 py-3 border-t border-white/5 bg-[#0c0c0f]">
      {/* Toolbar row: shown only when generating or always for new chat */}
      <div data-tour="stop-controls" className="flex items-center justify-between mb-2">
        {/* Stop generation — only shown when actively generating */}
        {isGenerating ? (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-800 border border-white/8 text-zinc-300 hover:text-white hover:border-zinc-600 transition text-xs font-medium"
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-current shrink-0" />
            Stop generating
          </button>
        ) : (
          <div />
        )}

        {/* New chat — always visible, right-aligned */}
        {onNewChat && (
          <button
            onClick={onNewChat}
            title="Start a new conversation"
            className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
            </svg>
            New chat
          </button>
        )}
      </div>

      {/* Image preview strip */}
      {imagePreview && (
        <div className="mb-2 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePreview} alt="preview" className="h-14 w-14 rounded-xl object-cover border border-white/10" />
          <button onClick={() => { setImagePreview(null); setImageBase64(null); setImageMimeType(null); }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition">
            Remove
          </button>
        </div>
      )}

      {/* Listening status pill */}
      {voiceInfo.active && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className={`relative flex h-2 w-2 shrink-0 ${voiceInfo.listening ? "" : "opacity-50"}`}>
            {voiceInfo.listening && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            )}
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-[11px] text-zinc-400">
            {voiceInfo.listening ? "Voice input on" : "Starting voice input…"}
          </span>
        </div>
      )}

      {/* Input card */}
      <div data-tour="chat-input" className={`flex items-end gap-2 bg-zinc-900 border rounded-2xl px-3 py-2.5 transition-colors ${
        disabled && !isGenerating ? "border-white/5 opacity-60" : "border-white/8 focus-within:border-zinc-600"
      }`}>
        {/* Camera / image attach */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          title="Attach image"
          className="shrink-0 p-1.5 text-zinc-500 hover:text-zinc-300 transition rounded-lg hover:bg-zinc-800 disabled:opacity-40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageSelect} className="hidden" />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          rows={1}
          placeholder={isGenerating ? "Generating…" : PLACEHOLDERS[mode]}
          className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 resize-none outline-none py-0.5 max-h-36 leading-relaxed"
        />

        {/* Voice — never disabled */}
        <VoiceButton
          onTranscript={handleTranscript}
          onBargeIn={onBargeIn}
          isSpeaking={isSpeaking}
          isGenerating={isGenerating}
          voiceReplies={voiceReplies}
          onVoiceActivity={setVoiceInfo}
        />

        {/* Send / Stop toggle */}
        {isGenerating ? (
          <button
            onClick={onStop}
            title="Stop generation"
            className="shrink-0 w-8 h-8 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-zinc-200 flex items-center justify-center transition"
          >
            {/* Square stop icon */}
            <span className="w-3 h-3 rounded-sm bg-current" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={disabled || (!value.trim() && !imageBase64)}
            title="Send"
            className="shrink-0 w-8 h-8 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-900 flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
