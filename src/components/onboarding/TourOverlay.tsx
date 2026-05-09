"use client";

import { useState, useEffect, useCallback } from "react";

export type TourStep = {
  targetId: string;       // data-tour="…" attribute on the target element
  title: string;
  body: string;
  align?: "top" | "bottom" | "left" | "right" | "center";
  beforeStep?: () => void; // e.g. switch a tab before highlighting
};

type Props = {
  steps: TourStep[];
  onDone: () => void;
};

const PAD = 10; // padding around spotlight

function useElementRect(targetId: string, deps: unknown[]) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    function measure() {
      const el = document.querySelector(`[data-tour="${targetId}"]`);
      if (el) {
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
      }
    }
    // Small delay so tab-switches / renders settle
    const t = setTimeout(measure, 120);
    window.addEventListener("resize", measure);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return rect;
}

export default function TourOverlay({ steps, onDone }: Props) {
  const [index, setIndex] = useState(0);

  const step = steps[index];

  // Run beforeStep hook when index changes
  useEffect(() => {
    step.beforeStep?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const rect = useElementRect(step.targetId, [index]);

  const next = useCallback(() => {
    if (index < steps.length - 1) setIndex((i) => i + 1);
    else onDone();
  }, [index, steps.length, onDone]);

  const prev = useCallback(() => {
    if (index > 0) setIndex((i) => i - 1);
  }, [index]);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") onDone();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onDone]);

  // ── Spotlight geometry ────────────────────────────────────────────────────
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  // Spotlight rect (with padding)
  const sp = rect
    ? {
        x: rect.left - PAD,
        y: rect.top - PAD,
        w: rect.width + PAD * 2,
        h: rect.height + PAD * 2,
        r: 12,
      }
    : { x: vw / 2 - 100, y: vh / 2 - 40, w: 200, h: 80, r: 12 };

  // ── Tooltip position ──────────────────────────────────────────────────────
  const TOOLTIP_W = 300;
  const TOOLTIP_MARGIN = 18;

  let align = step.align;
  if (!align) {
    // Auto-detect: prefer below unless element is in bottom 40% of screen
    align = sp.y + sp.h > vh * 0.6 ? "top" : "bottom";
  }

  let tooltipStyle: React.CSSProperties = {};
  if (align === "bottom") {
    tooltipStyle = {
      top: sp.y + sp.h + TOOLTIP_MARGIN,
      left: Math.min(Math.max(sp.x + sp.w / 2 - TOOLTIP_W / 2, 12), vw - TOOLTIP_W - 12),
    };
  } else if (align === "top") {
    tooltipStyle = {
      bottom: vh - sp.y + TOOLTIP_MARGIN,
      left: Math.min(Math.max(sp.x + sp.w / 2 - TOOLTIP_W / 2, 12), vw - TOOLTIP_W - 12),
    };
  } else if (align === "right") {
    tooltipStyle = {
      top: Math.max(sp.y, 12),
      left: sp.x + sp.w + TOOLTIP_MARGIN,
    };
  } else if (align === "left") {
    tooltipStyle = {
      top: Math.max(sp.y, 12),
      right: vw - sp.x + TOOLTIP_MARGIN,
    };
  } else {
    // center
    tooltipStyle = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  return (
    <>
      {/* SVG spotlight overlay */}
      <svg
        style={{ position: "fixed", inset: 0, zIndex: 40, pointerEvents: "none" }}
        width={vw}
        height={vh}
      >
        <defs>
          <mask id="tour-mask">
            <rect width={vw} height={vh} fill="white" />
            <rect x={sp.x} y={sp.y} width={sp.w} height={sp.h} rx={sp.r} fill="black" />
          </mask>
        </defs>
        <rect width={vw} height={vh} fill="rgba(0,0,0,0.72)" mask="url(#tour-mask)" />
        {/* Amber highlight border */}
        <rect
          x={sp.x} y={sp.y} width={sp.w} height={sp.h} rx={sp.r}
          fill="none" stroke="rgba(245,158,11,0.65)" strokeWidth="2"
        />
      </svg>

      {/* Click-blocker overlay (allows tooltip clicks through, blocks everything else) */}
      <div
        className="fixed inset-0 z-40"
        onClick={next}
      />

      {/* Tooltip card */}
      <div
        style={{ position: "fixed", zIndex: 50, width: TOOLTIP_W, ...tooltipStyle }}
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-5 flex flex-col gap-4"
      >
        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`rounded-full transition-all ${
                i === index
                  ? "w-4 h-1.5 bg-amber-400"
                  : i < index
                  ? "w-1.5 h-1.5 bg-zinc-500"
                  : "w-1.5 h-1.5 bg-zinc-700"
              }`}
            />
          ))}
          <span className="ml-auto text-[10px] text-zinc-600">{index + 1} / {steps.length}</span>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-zinc-100">{step.title}</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">{step.body}</p>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          {index > 0 && (
            <button onClick={prev}
              className="px-3 py-1.5 rounded-xl text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-800 border border-white/5 transition">
              ← Back
            </button>
          )}
          <button
            onClick={next}
            className="ml-auto px-4 py-1.5 rounded-xl text-xs font-semibold text-zinc-900 bg-amber-500 hover:bg-amber-400 transition"
          >
            {index === steps.length - 1 ? "Done ✓" : "Next →"}
          </button>
          <button onClick={onDone}
            className="text-[11px] text-zinc-600 hover:text-zinc-400 transition px-1">
            Skip
          </button>
        </div>
      </div>
    </>
  );
}
