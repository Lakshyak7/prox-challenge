"use client";

import { useState, useRef, useEffect, useCallback } from "react";

function isBackchannelNoise(transcript: string): boolean {
  const text = transcript.toLowerCase().trim();
  if (text.split(/\s+/).length > 7) return false;
  return /^(mhm+|mm+|uh huh|uh-huh|yeah+|yes+|yep|yup|nope|ok+|okay|sure|right|got it|gotcha|understood|understand|i see|i know|makes sense|exactly|absolutely|of course|definitely|certainly|fine|great|cool|nice|good|alright|all right|sounds good|perfect|wow|oh|ah+|hmm+|hm+|uh+|um+|er|true|indeed|noted|copy|roger|heard|word|totally|for sure|no doubt|okay then|yes sir|yes ma'am|thank you|thanks)$/i.test(text);
}

type Props = {
  onTranscript?: (transcript: string) => void;
  onBargeIn?: (transcript: string) => void;
  isSpeaking?: boolean;
  isGenerating?: boolean;
  voiceReplies?: boolean;
  onVoiceActivity?: (info: { active: boolean; listening: boolean }) => void;
};

export default function VoiceButton({ onTranscript, onBargeIn, isSpeaking, isGenerating, onVoiceActivity }: Props) {
  // voiceActive = user has turned voice mode on; persists across recognition cycles
  const [voiceActive, setVoiceActive] = useState(false);
  // listening = recognition is actively capturing audio right now
  const [listening, setListening] = useState(false);
  const onVoiceActivityRef = useRef(onVoiceActivity);
  useEffect(() => { onVoiceActivityRef.current = onVoiceActivity; }, [onVoiceActivity]);
  const [unsupported, setUnsupported] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);

  const voiceActiveRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const transcriptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualStopRef = useRef(false);
  const startingRef = useRef(false);
  const isSpeakingRef = useRef(isSpeaking);
  const isGeneratingRef = useRef(isGenerating);
  const listeningRef = useRef(false);

  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { isGeneratingRef.current = isGenerating; }, [isGenerating]);

  const setListeningWithCb = useCallback((val: boolean) => {
    listeningRef.current = val;
    setListening(val);
    onVoiceActivityRef.current?.({ active: voiceActiveRef.current, listening: val });
  }, []);

  const setVoiceActiveWithCb = useCallback((val: boolean) => {
    voiceActiveRef.current = val;
    setVoiceActive(val);
    onVoiceActivityRef.current?.({ active: val, listening: listeningRef.current });
  }, []);

  // When assistant starts speaking/generating, start recognition for barge-in
  useEffect(() => {
    if ((isSpeaking || isGenerating) && voiceActiveRef.current && !listening) {
      startListening();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpeaking, isGenerating]);

  function showFeedback(text: string) {
    if (transcriptTimerRef.current) clearTimeout(transcriptTimerRef.current);
    setLastTranscript(text.length > 50 ? text.slice(0, 50) + "…" : text);
    transcriptTimerRef.current = setTimeout(() => setLastTranscript(null), 3000);
  }

  function startListening() {
    if (startingRef.current || listeningRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) { setUnsupported(true); return; }

    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    manualStopRef.current = false;
    startingRef.current = true;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      // Only process the result that just became final — e.resultIndex is the new one
      const result = e.results[e.resultIndex];
      if (!result?.isFinal) return;
      const transcript = result[0]?.transcript ?? "";
      if (!transcript) return;
      showFeedback(transcript);
      if ((isSpeakingRef.current || isGeneratingRef.current) && onBargeIn) {
        if (!isBackchannelNoise(transcript)) onBargeIn(transcript);
      } else {
        onTranscript?.(transcript);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      // no-speech/audio-capture interruptions are normal in persistent voice mode.
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (!voiceActiveRef.current) setListeningWithCb(false);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      startingRef.current = false;

      if (manualStopRef.current || !voiceActiveRef.current) {
        setListeningWithCb(false);
        return;
      }

      // Chrome may end a recognition session after silence. Keep the UI in the
      // active/listening state while we silently re-open the recognizer.
      setListeningWithCb(true);
      restartTimerRef.current = setTimeout(() => {
        if (voiceActiveRef.current && !manualStopRef.current) startListening();
      }, 350);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListeningWithCb(true);
    } catch {
      startingRef.current = false;
    }
  }

  function toggle() {
    if (unsupported) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) { setUnsupported(true); return; }

    if (voiceActive) {
      manualStopRef.current = true;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      setVoiceActiveWithCb(false);
      setListeningWithCb(false);
      setLastTranscript(null);
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    } else {
      manualStopRef.current = false;
      setVoiceActiveWithCb(true);
      startListening();
    }
  }

  if (unsupported) {
    return (
      <button disabled title="Speech recognition not supported in this browser"
        className="p-2 rounded-xl bg-zinc-800 text-zinc-600 cursor-not-allowed">
        <MicIcon />
      </button>
    );
  }

  return (
    <div data-tour="voice-mic" className="relative shrink-0">
      {/* Transcript feedback pill — floats above button */}
      {lastTranscript && (
        <div className="absolute bottom-full right-0 mb-2 z-10 bg-zinc-800 border border-white/10 rounded-xl px-3 py-1.5 shadow-xl pointer-events-none whitespace-nowrap max-w-[240px]">
          <span className="text-[10px] text-zinc-500 mr-1.5 uppercase tracking-wide">Heard</span>
          <span className="text-xs text-zinc-200 truncate">&ldquo;{lastTranscript}&rdquo;</span>
        </div>
      )}

      <button
        onClick={toggle}
        title={voiceActive ? "Voice on — click to stop" : "Click to start voice input"}
        className={`relative p-2.5 rounded-xl text-sm transition-all ${
          voiceActive
            ? "bg-red-600 text-white shadow-lg shadow-red-900/50"
            : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
        }`}
      >
        {/* Pulsing ring while actively capturing audio */}
        {voiceActive && listening && (
          <span className="absolute inset-0 rounded-xl animate-ping bg-red-500 opacity-40 pointer-events-none" />
        )}
        <MicIcon />
      </button>

      {/* Steady dot when active but between recognition cycles */}
      {voiceActive && !listening && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-400 shadow shadow-red-800" />
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
      <path d="M19 10v2a7 7 0 01-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  );
}
