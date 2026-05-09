"use client";

import { useState, useEffect, useRef } from "react";
import type { GuidedStep } from "@/lib/types";
import type { Doc } from "@/components/manual/PdfViewer";

type Props = {
  title: string;
  intro: string;
  steps: GuidedStep[];
  onAskFollowUp: (q: string) => void;
  voiceReplies?: boolean;
  onOpenManualPage?: (doc: Doc, page: number) => void;
};

export default function GuidedSession({ title, intro: _intro, steps, onAskFollowUp, voiceReplies, onOpenManualPage }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [showTip, setShowTip] = useState(false);
  const [done, setDone] = useState(false);
  const prevIndexRef = useRef(-1);

  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  // Auto-speak the current step when it changes
  useEffect(() => {
    if (!voiceReplies || prevIndexRef.current === stepIndex) return;
    prevIndexRef.current = stepIndex;
    if ("speechSynthesis" in window && step) {
      window.speechSynthesis.cancel();
      const text = done
        ? `${title} complete! All steps done.`
        : `Step ${stepIndex + 1}: ${step.title}. ${step.instruction} ${step.check}`;
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.96;
      window.speechSynthesis.speak(utter);
    }
  }, [stepIndex, done, step, title, voiceReplies]);

  function handleNext() {
    setShowTip(false);
    if (isLast) { setDone(true); return; }
    setStepIndex((i) => i + 1);
  }

  function handleBack() {
    if (isFirst) return;
    setShowTip(false);
    setDone(false);
    setStepIndex((i) => i - 1);
  }

  function handleTellMeMore() {
    onAskFollowUp(
      `I'm on step ${stepIndex + 1} of the "${title}" guide: "${step.title}". Can you explain this in more detail and tell me what to watch out for?`
    );
  }

  if (done) {
    return (
      <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm">
            ✓
          </div>
          <div>
            <div className="text-sm font-semibold text-emerald-300">{title} — complete</div>
            <div className="text-xs text-zinc-500 mt-0.5">All {steps.length} steps done</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setDone(false); setStepIndex(steps.length - 1); }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition px-3 py-1.5 rounded-lg bg-zinc-800 border border-white/5"
          >
            ← Review last step
          </button>
          <button
            onClick={() => onAskFollowUp(`I just finished the ${title}. What should I do next?`)}
            className="text-xs text-amber-300 hover:text-amber-200 transition px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20"
          >
            What's next?
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-white/8 bg-[#14141a] overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{title}</span>
          <span className="text-[11px] text-zinc-600">
            Step {stepIndex + 1} of {steps.length}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step body */}
      <div className="px-4 py-4">
        <h3 className="text-sm font-semibold text-zinc-100 mb-2">{step.title}</h3>
        <p className="text-sm text-zinc-300 leading-relaxed">{step.instruction}</p>

        {/* Tip */}
        {step.tip && (
          <div className="mt-3">
            {showTip ? (
              <div className="text-xs text-amber-300/80 bg-amber-500/8 border border-amber-500/15 rounded-xl px-3 py-2 leading-relaxed">
                {step.tip}
              </div>
            ) : (
              <button
                onClick={() => setShowTip(true)}
                className="text-[11px] text-zinc-600 hover:text-amber-400 transition"
              >
                ✦ Show tip
              </button>
            )}
          </div>
        )}

        {/* Manual page reference */}
        {step.manualPage && (
          <button
            onClick={() => onOpenManualPage?.("owner-manual", step.manualPage!)}
            className="mt-2 text-[11px] text-amber-600 hover:text-amber-400 transition text-left"
          >
            Manual p.{step.manualPage} →
          </button>
        )}

        {/* Verification question */}
        <div className="mt-4 pt-3 border-t border-white/5">
          <p className="text-xs text-zinc-500 italic">{step.check}</p>
        </div>
      </div>

      {/* Action bar */}
      <div className="px-4 pb-4 flex items-center gap-2">
        <button
          onClick={handleBack}
          disabled={isFirst}
          className="px-3 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-300 bg-zinc-800 border border-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          ← Back
        </button>

        <button
          onClick={handleTellMeMore}
          className="px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800 border border-white/5 transition"
        >
          Tell me more
        </button>

        <button
          onClick={handleNext}
          className="ml-auto px-4 py-2 rounded-xl text-xs font-semibold text-zinc-900 bg-amber-500 hover:bg-amber-400 transition"
        >
          {isLast ? "Done ✓ Finish" : "Done — Next →"}
        </button>
      </div>
    </div>
  );
}
