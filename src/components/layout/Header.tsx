"use client";

import { useEffect, useState } from "react";
import type { Tab } from "@/components/AppShell";
import type { SupportMode } from "@/lib/types";

type Props = {
  tab: Tab;
  mode: SupportMode;
  voiceReplies: boolean;
  voices: SpeechSynthesisVoice[];
  selectedVoiceName: string;
  onTabChange: (t: Tab) => void;
  onModeChange: (m: SupportMode) => void;
  onVoiceRepliesChange: (enabled: boolean) => void;
  onVoiceChange: (name: string) => void;
};

const MODES: Array<{ value: SupportMode; label: string }> = [
  { value: "using", label: "Using" },
  { value: "setup", label: "Setup" },
  { value: "debugging", label: "Debug" },
  { value: "testing", label: "Test" },
  { value: "fixing", label: "Fix" },
];

export default function Header({ tab, mode, voiceReplies, voices, selectedVoiceName, onTabChange, onModeChange, onVoiceRepliesChange, onVoiceChange }: Props) {
  const [ingested, setIngested] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/ingest")
      .then((r) => r.json())
      .then((d: { ingested: boolean }) => setIngested(d.ingested))
      .catch(() => setIngested(false));
  }, []);

  // Show only English voices, deduplicated by name
  const englishVoices = voices.filter((v) => v.lang.startsWith("en"));

  return (
    <header className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/5 bg-[#0c0c0f]">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <span className="text-amber-400 text-sm">⚡</span>
        </div>
        <div>
          <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">Vulcan OmniPro 220</h1>
          <p className="text-[11px] text-zinc-500 leading-none mt-0.5">Support Agent</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div data-tour="mode-selector" className="hidden md:flex gap-0.5 bg-zinc-900 p-1 rounded-xl border border-white/5">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => onModeChange(m.value)}
              title={`${m.label} mode`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === m.value
                  ? "bg-amber-500/15 text-amber-200 border border-amber-500/20"
                  : "text-zinc-500 hover:text-zinc-300 border border-transparent"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Voice toggle */}
        <button
          data-tour="voice-toggle"
          onClick={() => onVoiceRepliesChange(!voiceReplies)}
          title={voiceReplies ? "Voice replies on" : "Voice replies off"}
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
            voiceReplies
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <span>{voiceReplies ? "Voice on" : "Voice off"}</span>
        </button>

        {/* Voice picker — only when voice replies is on and voices are available */}
        {voiceReplies && englishVoices.length > 0 && (
          <select
            value={selectedVoiceName}
            onChange={(e) => onVoiceChange(e.target.value)}
            title="Change voice"
            className="hidden sm:block bg-zinc-900 border border-white/5 rounded-xl text-xs text-zinc-400 px-2.5 py-1.5 outline-none focus:border-zinc-600 transition max-w-[150px] truncate"
          >
            <option value="">Default voice</option>
            {englishVoices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name.replace(/^(Microsoft|Google)\s+/i, "")}
              </option>
            ))}
          </select>
        )}

        {/* Tabs */}
        <div className="flex gap-0.5 bg-zinc-900 p-1 rounded-xl border border-white/5">
          {([
            { id: "chat", label: "Chat" },
            { id: "canvas", label: "Canvas" },
            { id: "manual", label: "Manual" },
          ] as Array<{ id: Tab; label: string }>).map((t) => (
            <button
              key={t.id}
              data-tour={`${t.id}-tab`}
              onClick={() => onTabChange(t.id)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === t.id
                  ? "bg-zinc-700 text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Ingest status */}
        {ingested === true && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Indexed
          </div>
        )}
        {ingested === false && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Run <code className="font-mono text-amber-300 ml-0.5">pnpm ingest</code>
          </div>
        )}
      </div>
    </header>
  );
}
