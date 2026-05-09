"use client";

import { useState, useEffect } from "react";
import WelcomeModal from "./WelcomeModal";
import TourOverlay from "./TourOverlay";
import type { TourStep } from "./TourOverlay";

const STORAGE_KEY = "omnipro-onboarding-v1";

type Phase = "welcome" | "tour" | "done";

type Props = {
  onSwitchTab: (tab: "chat" | "canvas" | "manual") => void;
};

function buildSteps(switchTab: Props["onSwitchTab"]): TourStep[] {
  return [
    {
      targetId: "chat-thread",
      title: "Ask anything about your welder",
      body: "Type a question and the AI answers from the owner's manual. Ask about setup, troubleshooting, settings, safety — anything related to the OmniPro 220.",
      align: "right",
    },
    {
      targetId: "mode-selector",
      title: "Match the mode to your task",
      body: "Using keeps answers brief. Setup walks through cable and polarity checks. Debug reasons from symptoms. Test suggests verification steps. Fix prioritises safe disassembly and inspection.",
      align: "bottom",
    },
    {
      targetId: "chat-input",
      title: "Type or speak your question",
      body: "Type and press Enter to send. The AI validates your question is in scope and guides you if it's unclear.",
      align: "top",
    },
    {
      targetId: "voice-mic",
      title: "Hands-free voice input",
      body: "Click the mic to start listening. It stays red and on until you click again — ask naturally. If the AI is mid-answer and you speak, it stops and responds to you immediately.",
      align: "top",
    },
    {
      targetId: "voice-toggle",
      title: "Voice replies",
      body: "Toggle this on and the AI reads its answers aloud — great when your hands are on the machine. Sentences are spoken as they stream, not after the full reply.",
      align: "bottom",
    },
    {
      targetId: "stop-controls",
      title: "Stop and reset",
      body: "While the AI is generating you'll see a ⏹ stop button — click it to interrupt mid-response. 'New chat' resets the whole conversation back to the welcome message.",
      align: "top",
    },
    {
      targetId: "canvas-tab",
      title: "Canvas — visual artifacts",
      body: "When the AI produces a polarity diagram, duty-cycle calculator, settings configurator, troubleshooting flowchart, or guided walkthrough, it appears here on the Canvas.",
      align: "bottom",
      beforeStep: () => switchTab("chat"),
    },
    {
      targetId: "manual-tab",
      title: "Browse the full manual",
      body: "Open the Manual tab to scroll through the Owner Manual, Quick Start Guide, or Selection Chart. Search by keyword and the results jump you straight to that page. Citations in chat also link here.",
      align: "bottom",
    },
  ];
}

export default function Onboarding({ onSwitchTab }: Props) {
  const [phase, setPhase] = useState<Phase>("done"); // start hidden, load from storage

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) setPhase("welcome");
  }, []);

  function finish() {
    localStorage.setItem(STORAGE_KEY, "1");
    setPhase("done");
  }

  if (phase === "done") return null;

  if (phase === "welcome") {
    return (
      <WelcomeModal
        onTour={() => setPhase("tour")}
        onSkip={finish}
      />
    );
  }

  return (
    <TourOverlay
      steps={buildSteps(onSwitchTab)}
      onDone={finish}
    />
  );
}
