"use client";

import { useState, useEffect } from "react";
import {
  THICKNESS_OPTIONS,
  getMaterials,
  getAvailableThicknesses,
  type WeldProcess,
  type WeldMaterial,
} from "@/lib/weld-settings";

export type WeldContext = {
  process: WeldProcess;
  material: WeldMaterial;
  thicknessIn: number;
  notes?: string;
};

type Props = {
  value: WeldContext | null;
  onChange: (ctx: WeldContext | null) => void;
};

const PROCESSES: Array<{ value: WeldProcess; label: string; icon: string }> = [
  { value: "mig",       label: "MIG",        icon: "🔵" },
  { value: "flux-core", label: "Flux-Core",  icon: "🟡" },
  { value: "tig",       label: "TIG",        icon: "🟠" },
  { value: "stick",     label: "Stick",      icon: "🔴" },
];

const STORAGE_KEY = "omnipro-weld-context";

export default function WeldContextPanel({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [process, setProcess] = useState<WeldProcess | null>(value?.process ?? null);
  const [material, setMaterial] = useState<WeldMaterial>(() => {
    const mats = getMaterials(value?.process ?? "mig");
    return (value?.material && mats.includes(value.material)) ? value.material : mats[0];
  });
  const [thicknessIn, setThicknessIn] = useState(value?.thicknessIn ?? 0.125);
  const [notes, setNotes] = useState(value?.notes ?? "");

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const ctx = JSON.parse(saved) as WeldContext;
        setProcess(ctx.process);
        setMaterial(ctx.material);
        setThicknessIn(ctx.thicknessIn);
        setNotes(ctx.notes ?? "");
        onChange(ctx);
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const materials = process ? getMaterials(process) : [];
  const availableThicknesses = process ? getAvailableThicknesses(process, material) : [];

  function onProcessToggle(p: WeldProcess) {
    if (process === p) {
      // deselect
      setProcess(null);
    } else {
      setProcess(p);
      const mats = getMaterials(p);
      if (!mats.includes(material)) setMaterial(mats[0]);
    }
  }

  function apply() {
    if (!process) return;
    const ctx: WeldContext = { process, material, thicknessIn, notes: notes.trim() || undefined };
    onChange(ctx);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
    setOpen(false);
  }

  function clear() {
    setProcess(null);
    onChange(null);
    localStorage.removeItem(STORAGE_KEY);
    setOpen(false);
  }

  const thicknessLabel = THICKNESS_OPTIONS.find((t) => Math.abs(t.inches - thicknessIn) < 0.005)?.label ?? `${thicknessIn}"`;
  const processLabel = PROCESSES.find((p) => p.value === process)?.label ?? process;

  const selectCls = "w-full bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 px-2.5 py-1.5 outline-none focus:border-amber-500/50 transition";
  const labelCls = "text-[11px] text-zinc-500 uppercase tracking-wide block mb-1";

  return (
    <div className="border-t border-white/5">
      {/* Collapsed pill */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-zinc-800/40 transition text-left"
      >
        <span className="text-[11px] text-zinc-500 uppercase tracking-wide flex-1">
          {value ? (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span className="text-zinc-400">
                {processLabel} · {value.material} · {thicknessLabel}
              </span>
            </span>
          ) : (
            "Set weld context"
          )}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`text-zinc-600 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded form */}
      {open && (
        <div className="px-4 pb-4 space-y-3 bg-zinc-900/60">
          <p className="text-[11px] text-zinc-500 pt-1">
            Tell the AI what you are working on so it can give you exact settings and tailored advice.
          </p>

          {/* Process */}
          <div>
            <label className={labelCls}>Process <span className="normal-case text-zinc-600">(tap to select · tap again to remove)</span></label>
            <div className="grid grid-cols-4 gap-1">
              {PROCESSES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => onProcessToggle(p.value)}
                  className={`relative py-1.5 rounded-lg text-xs font-medium transition border ${
                    process === p.value
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                      : "border-zinc-700 text-zinc-500 hover:text-zinc-300 bg-zinc-800"
                  }`}
                >
                  {p.label}
                  {process === p.value && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-zinc-700 border border-zinc-600 text-zinc-400 flex items-center justify-center text-[8px] leading-none">✕</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Material + Thickness — only when process selected */}
          {process && (
            <>
              <div>
                <label className={labelCls}>Material</label>
                <select value={material} onChange={(e) => setMaterial(e.target.value as WeldMaterial)} className={selectCls}>
                  {materials.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Metal Thickness</label>
                <select
                  value={thicknessIn}
                  onChange={(e) => setThicknessIn(Number(e.target.value))}
                  className={selectCls}
                >
                  {THICKNESS_OPTIONS.filter((t) =>
                    availableThicknesses.length === 0 ||
                    availableThicknesses.some((a) => Math.abs(a - t.inches) < 0.005)
                  ).map((t) => (
                    <option key={t.inches} value={t.inches}>{t.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label className={labelCls}>Additional notes <span className="normal-case">(optional)</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. outdoor, vertical position, rusty metal..."
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 px-2.5 py-1.5 outline-none focus:border-amber-500/50 transition resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={apply}
              disabled={!process}
              className="flex-1 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-900 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apply context
            </button>
            {(value || process) && (
              <button
                onClick={clear}
                className="px-3 py-2 rounded-xl text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-800 border border-white/5 transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
