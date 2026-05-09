"use client";

import { useState, useEffect, useRef } from "react";
import type { ManualSearchResult } from "@/app/api/manual-search/route";

const DOC_LABEL: Record<ManualSearchResult["doc"], string> = {
  "owner-manual": "Owner Manual",
  "quick-start-guide": "Quick Start",
  "selection-chart": "Selection Chart",
};

type Props = { onClose: () => void };

export default function ManualSearch({ onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ManualSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/manual-search?q=${encodeURIComponent(query)}`);
        const data = await res.json() as { results: ManualSearchResult[] };
        setResults(data.results);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4" onClick={onClose}>
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden
      />
      <div
        className="relative w-full max-w-xl bg-zinc-900 border border-white/8 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <svg className="text-zinc-500 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the OmniPro 220 manual…"
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
          />
          {loading && (
            <div className="w-4 h-4 rounded-full border-2 border-zinc-600 border-t-amber-400 animate-spin" />
          )}
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition text-xs">
            esc
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {results.length === 0 && query && !loading && (
            <div className="px-4 py-8 text-center text-xs text-zinc-600">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}
          {results.length === 0 && !query && (
            <div className="px-4 py-8 text-center text-xs text-zinc-600">
              Try searching: polarity, duty cycle, wire speed, gas flow, TIG, flux core…
            </div>
          )}
          {results.map((r, i) => (
            <a
              key={i}
              href={`/api/manual/${r.doc}#page=${r.page}`}
              target="_blank"
              rel="noreferrer"
              className="flex gap-3 px-4 py-3 hover:bg-zinc-800 transition border-b border-white/5 last:border-0 group"
            >
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-amber-500 uppercase tracking-wider">
                    {DOC_LABEL[r.doc]}
                  </span>
                  <span className="text-[10px] text-zinc-600">p.{r.page}</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed line-clamp-2 group-hover:text-zinc-100 transition">
                  {r.excerpt}
                </p>
              </div>
              <svg className="shrink-0 mt-1 text-zinc-600 group-hover:text-zinc-400 transition" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
