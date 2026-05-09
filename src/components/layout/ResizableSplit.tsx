"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeft?: number;      // default left panel width %
  minLeft?: number;          // minimum left % when open
  maxLeft?: number;          // maximum left %
  collapsible?: "left" | "right";  // which side can collapse
  collapsedLabel?: string;   // label shown in slim collapsed strip
  collapsedIcon?: string;
  storageKey?: string;       // persist split in localStorage
};

const DIVIDER_HIT = 8;       // px hit area for drag
const COLLAPSED_W = 36;      // px for the collapsed strip

export default function ResizableSplit({
  left,
  right,
  defaultLeft = 62,
  minLeft = 20,
  maxLeft = 80,
  collapsible,
  collapsedLabel = "Panel",
  collapsedIcon = "⚡",
  storageKey,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastSplit = useRef(defaultLeft);

  const [split, setSplit] = useState<number>(() => {
    if (storageKey && typeof window !== "undefined") {
      const s = localStorage.getItem(`rsplit:${storageKey}`);
      if (s) return Math.max(minLeft, Math.min(maxLeft, parseFloat(s)));
    }
    return defaultLeft;
  });

  const [collapsed, setCollapsed] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (collapsed) return;
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [collapsed]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const raw = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(minLeft, Math.min(maxLeft, raw));
      setSplit(clamped);
    }

    function onUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (storageKey) {
        setSplit((s) => {
          localStorage.setItem(`rsplit:${storageKey}`, String(s));
          return s;
        });
      }
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [minLeft, maxLeft, storageKey]);

  function collapse() {
    lastSplit.current = split;
    setCollapsed(true);
  }

  function expand() {
    setSplit(lastSplit.current);
    setCollapsed(false);
  }

  // Collapsed: one panel becomes a slim vertical strip
  if (collapsed) {
    return (
      <div ref={containerRef} className="h-full flex overflow-hidden">
        {collapsible === "left" ? (
          <>
            {/* Slim left strip */}
            <button
              onClick={expand}
              title={`Expand ${collapsedLabel}`}
              className="shrink-0 h-full flex flex-col items-center justify-center gap-3 bg-zinc-900/70 border-r border-white/5 hover:bg-zinc-800/70 transition-colors group"
              style={{ width: COLLAPSED_W }}
            >
              <span className="text-sm">{collapsedIcon}</span>
              <span
                className="text-[9px] text-zinc-500 group-hover:text-zinc-300 uppercase tracking-widest transition-colors"
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
              >
                {collapsedLabel}
              </span>
              <span className="text-zinc-500 group-hover:text-amber-400 transition-colors text-xs">▶</span>
            </button>
            {/* Right fills remaining */}
            <div className="flex-1 min-w-0 overflow-hidden">{right}</div>
          </>
        ) : (
          <>
            {/* Left fills space */}
            <div className="flex-1 min-w-0 overflow-hidden">{left}</div>
            {/* Slim right strip */}
            <button
              onClick={expand}
              title={`Expand ${collapsedLabel}`}
              className="shrink-0 h-full flex flex-col items-center justify-center gap-3 bg-zinc-900/70 border-l border-white/5 hover:bg-zinc-800/70 transition-colors group"
              style={{ width: COLLAPSED_W }}
            >
              <span className="text-xs text-zinc-500 group-hover:text-amber-400 transition-colors">◀</span>
              <span
                className="text-[9px] text-zinc-500 group-hover:text-zinc-300 uppercase tracking-widest transition-colors"
                style={{ writingMode: "vertical-rl" }}
              >
                {collapsedLabel}
              </span>
              <span className="text-sm">{collapsedIcon}</span>
            </button>
          </>
        )}
      </div>
    );
  }

  // Normal: left panel + draggable divider + right panel
  return (
    <div ref={containerRef} className="h-full flex overflow-hidden">
      {/* Left */}
      <div style={{ width: `${split}%` }} className="h-full overflow-hidden shrink-0">
        {left}
      </div>

      {/* Draggable divider */}
      <div
        className="relative shrink-0 flex items-center justify-center group z-10"
        style={{ width: DIVIDER_HIT, cursor: "col-resize" }}
        onMouseDown={handleMouseDown}
      >
        {/* Visual track */}
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/5 group-hover:bg-amber-500/30 transition-colors" />

        {/* Grip dots */}
        <div className="absolute flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {[0,1,2,3,4].map((i) => (
            <span key={i} className="w-0.5 h-0.5 rounded-full bg-zinc-500" />
          ))}
        </div>

        {/* Collapse button */}
        {collapsible && (
          <button
            onClick={(e) => { e.stopPropagation(); collapse(); }}
            title={`Collapse ${collapsedLabel}`}
            className="absolute z-20 w-5 h-10 rounded bg-zinc-800 border border-white/10 hover:border-amber-500/30 hover:bg-zinc-700 text-zinc-500 hover:text-amber-300 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg text-[10px] select-none"
          >
            {collapsible === "left" ? "◀" : "▶"}
          </button>
        )}
      </div>

      {/* Right */}
      <div className="h-full overflow-hidden flex-1 min-w-0">
        {right}
      </div>
    </div>
  );
}
