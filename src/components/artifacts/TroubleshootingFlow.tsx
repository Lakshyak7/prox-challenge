"use client";

import { useState } from "react";
import type { TroubleshootingStep } from "@/lib/types";

type Props = { issue?: string; title?: string; steps: TroubleshootingStep[] };

// ── Decision-tree mode ───────────────────────────────────────────────────────

function DecisionTree({ steps, heading }: { steps: TroubleshootingStep[]; heading: string }) {
  const [currentId, setCurrentId] = useState<string | number>(steps[0]?.id ?? 1);
  const [noAction, setNoAction] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const step = steps.find((s) => String(s.id) === String(currentId));

  function handleYes() {
    if (!step) return;
    setNoAction(null);
    const target = step.yes;
    if (typeof target === "number" || (typeof target === "string" && steps.some(s => String(s.id) === String(target)))) {
      setCurrentId(target as string | number);
    } else {
      setDone(typeof target === "string" ? target : "All checks passed!");
    }
  }

  function handleNo() {
    if (!step?.no) return;
    setNoAction(step.no);
  }

  const stepIndex = steps.findIndex((s) => String(s.id) === String(currentId));
  const progress = done ? 100 : Math.round(((stepIndex) / steps.length) * 100);

  if (done) {
    return (
      <div className="p-5 flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-100">{done}</p>
          <p className="text-xs text-zinc-500 mt-1">{heading}</p>
        </div>
        <button
          onClick={() => { setCurrentId(steps[0]?.id ?? 1); setDone(null); setNoAction(null); }}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition underline"
        >
          Start over
        </button>
      </div>
    );
  }

  if (!step) return null;

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Header + progress */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{heading}</p>
        <span className="text-[11px] text-zinc-600">Step {stepIndex + 1} / {steps.length}</span>
      </div>
      <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
        <div className="h-1 bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Check question */}
      <div className="rounded-xl bg-zinc-800 border border-white/8 px-4 py-4">
        <p className="text-sm font-medium text-zinc-100 leading-snug">{step.check}</p>
      </div>

      {/* No action hint */}
      {noAction && (
        <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 px-4 py-3 flex gap-2 items-start">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 mt-0.5 shrink-0" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-xs text-amber-200 leading-relaxed">{noAction}</p>
        </div>
      )}

      {/* Yes / No buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleNo}
          className="py-2.5 rounded-xl border border-red-500/30 bg-red-500/8 text-red-300 text-sm font-medium hover:bg-red-500/15 transition"
        >
          ✗ No
        </button>
        <button
          onClick={handleYes}
          className="py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/8 text-emerald-300 text-sm font-medium hover:bg-emerald-500/15 transition"
        >
          ✓ Yes
        </button>
      </div>

      {/* Step trail */}
      {stepIndex > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          {steps.slice(0, stepIndex).map((s, i) => (
            <button
              key={s.id}
              onClick={() => { setCurrentId(s.id); setNoAction(null); }}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 transition"
            >
              ← {i + 1}. {String(s.check ?? "").slice(0, 20)}{(s.check ?? "").length > 20 ? "…" : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Checklist mode (legacy format with description) ──────────────────────────

function Checklist({ steps, heading }: { steps: TroubleshootingStep[]; heading: string }) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{heading}</p>
        <span className="text-[11px] text-zinc-600">{completed.size}/{steps.length}</span>
      </div>
      <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
        <div className="h-1 bg-amber-500 rounded-full transition-all" style={{ width: steps.length > 0 ? `${(completed.size / steps.length) * 100}%` : "0%" }} />
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((step, i) => {
          const id = String(step.id);
          const done = completed.has(id);
          return (
            <li key={id} onClick={() => toggle(id)}
              className={`flex gap-3 items-start p-3 rounded-xl cursor-pointer border transition ${
                done ? "border-emerald-800/40 bg-emerald-900/10 text-zinc-500" : "border-zinc-700 bg-zinc-800/50 text-zinc-200 hover:border-zinc-500"
              }`}>
              <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs shrink-0 mt-0.5 ${
                done ? "border-emerald-600 bg-emerald-700 text-emerald-300" : "border-zinc-600 text-zinc-500"
              }`}>
                {done ? "✓" : i + 1}
              </span>
              <span className={`text-sm ${done ? "line-through" : ""}`}>{step.description}</span>
              {step.manualPage && <span className="ml-auto text-xs text-zinc-600 shrink-0">p.{step.manualPage}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── Top-level component ──────────────────────────────────────────────────────

export default function TroubleshootingFlow({ issue, title, steps }: Props) {
  const heading = title ?? issue ?? "Troubleshooting";
  const isDecisionTree = steps.length > 0 && steps[0].check != null;

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/8">
      {isDecisionTree
        ? <DecisionTree steps={steps} heading={heading} />
        : <Checklist steps={steps} heading={heading} />}
    </div>
  );
}
