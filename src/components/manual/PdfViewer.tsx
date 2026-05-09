"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ManualSearchResult } from "@/app/api/manual-search/route";

const PDFJS_VERSION = "3.11.174";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

export type Doc = "owner-manual" | "quick-start-guide" | "selection-chart";

export const DOCS: Array<{ id: Doc; label: string }> = [
  { id: "owner-manual", label: "Owner Manual" },
  { id: "quick-start-guide", label: "Quick Start" },
  { id: "selection-chart", label: "Selection Chart" },
];

let pdfJsReady: Promise<void> | null = null;
function loadPdfJs(): Promise<void> {
  if (pdfJsReady) return pdfJsReady;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).pdfjsLib) return (pdfJsReady = Promise.resolve());
  pdfJsReady = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${PDFJS_CDN}/pdf.min.js`;
    s.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      resolve();
    };
    s.onerror = () => reject(new Error("pdfjs load failed"));
    document.head.appendChild(s);
  });
  return pdfJsReady;
}

// ── Single page canvas, renders lazily when it enters the viewport ────────────
type PageCanvasProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfDoc: any;
  pageNum: number;
  width: number;
};

function PageCanvas({ pdfDoc, pageNum, width }: PageCanvasProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    setRendered(false);
    renderTaskRef.current?.cancel();
  }, [pdfDoc, width]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || rendered) return;

    const obs = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting) return;
        obs.disconnect();
        try {
          const page = await pdfDoc.getPage(pageNum);
          const baseVp = page.getViewport({ scale: 1 });
          const scale = width / baseVp.width;
          const vp = page.getViewport({ scale });
          const canvas = canvasRef.current;
          if (!canvas) return;
          canvas.width = vp.width;
          canvas.height = vp.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          const task = page.render({ canvasContext: ctx, viewport: vp });
          renderTaskRef.current = task;
          await task.promise;
          setRendered(true);
        } catch (e) {
          if (!(e instanceof Error && e.name === "RenderingCancelledException")) {
            setRendered(true); // stop skeleton on error too
          }
        }
      },
      { rootMargin: "300px 0px" }
    );

    obs.observe(root);
    return () => { obs.disconnect(); renderTaskRef.current?.cancel(); };
  }, [pdfDoc, pageNum, width, rendered]);

  // Aspect ratio placeholder (typical PDF is A4 or Letter ≈ 1.294 tall)
  const placeholderHeight = Math.round(width * 1.294);

  return (
    <div ref={rootRef} className="relative bg-white rounded-lg shadow-lg overflow-hidden"
      style={{ minHeight: rendered ? 0 : placeholderHeight }}>
      {!rendered && (
        <div className="absolute inset-0 bg-zinc-200 animate-pulse" style={{ height: placeholderHeight }} />
      )}
      <canvas ref={canvasRef} className="w-full block" style={{ display: rendered ? "block" : "none" }} />
    </div>
  );
}

// ── PdfViewer ────────────────────────────────────────────────────────────────
export type ManualTarget = { doc: Doc; page: number };

type Props = { navigateTo?: ManualTarget };

export default function PdfViewer({ navigateTo }: Props) {
  const [doc, setDoc] = useState<Doc>("owner-manual");
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [width, setWidth] = useState(640);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ManualSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pendingScrollRef = useRef<number | null>(null);

  // Measure container width
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.max(200, entry.contentRect.width - 48));
    });
    ro.observe(el);
    setWidth(Math.max(200, el.clientWidth - 48));
    return () => ro.disconnect();
  }, []);

  // Load PDF when doc changes
  useEffect(() => {
    setPdfDoc(null);
    setTotalPages(0);
    setCurrentPage(1);
    pageContainerRefs.current = [];

    let cancelled = false;
    async function load() {
      try {
        await loadPdfJs();
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lib = (window as any).pdfjsLib;
        const pdf = await lib.getDocument(`/api/manual/${doc}`).promise;
        if (cancelled) return;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        pageContainerRefs.current = new Array(pdf.numPages).fill(null);
      } catch { /* ignore */ }
    }
    load();
    return () => { cancelled = true; };
  }, [doc]);

  // After PDF loads, scroll to any pending page
  useEffect(() => {
    if (pdfDoc && pendingScrollRef.current != null) {
      const target = pendingScrollRef.current;
      pendingScrollRef.current = null;
      setTimeout(() => scrollToPage(target), 150);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc]);

  // Handle external navigation from chat
  useEffect(() => {
    if (!navigateTo) return;
    if (navigateTo.doc !== doc) {
      pendingScrollRef.current = navigateTo.page;
      setDoc(navigateTo.doc);
    } else {
      scrollToPage(navigateTo.page);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigateTo]);

  const scrollToPage = useCallback((page: number) => {
    const el = pageContainerRefs.current[page - 1];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setCurrentPage(page);
    }
  }, []);

  // Track visible page on scroll
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const containerMid = container.scrollTop + container.clientHeight / 2;
    let closest = 1;
    let minDist = Infinity;
    pageContainerRefs.current.forEach((ref, i) => {
      if (!ref) return;
      const mid = ref.offsetTop + ref.offsetHeight / 2;
      const dist = Math.abs(mid - containerMid);
      if (dist < minDist) { minDist = dist; closest = i + 1; }
    });
    setCurrentPage(closest);
  }, []);

  // Search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/manual-search?q=${encodeURIComponent(query)}`);
        const data = await res.json() as { results: ManualSearchResult[] };
        setResults(data.results);
      } finally { setSearching(false); }
    }, 300);
  }, [query]);

  function goToResult(r: ManualSearchResult) {
    setQuery(""); setResults([]);
    if (r.doc !== doc) {
      pendingScrollRef.current = r.page;
      setDoc(r.doc);
    } else {
      scrollToPage(r.page);
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#0a0a0d]">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-white/5 px-4 py-2 flex items-center gap-3 bg-[#0c0c0f]">
        {/* Doc tabs */}
        <div className="flex gap-0.5 bg-zinc-900 p-1 rounded-xl border border-white/5 shrink-0">
          {DOCS.map((d) => (
            <button key={d.id} onClick={() => { setDoc(d.id); }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                doc === d.id
                  ? "bg-amber-500/15 text-amber-200 border border-amber-500/20"
                  : "text-zinc-500 hover:text-zinc-300 border border-transparent"
              }`}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 relative">
          <div className="flex items-center gap-2 bg-zinc-900 border border-white/8 rounded-xl px-3 py-1.5 focus-within:border-zinc-600 transition">
            <svg className="text-zinc-500 shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search manual…"
              className="flex-1 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-600 outline-none" />
            {searching && <div className="w-3 h-3 rounded-full border border-zinc-600 border-t-amber-400 animate-spin shrink-0" />}
            {query && !searching && (
              <button onClick={() => { setQuery(""); setResults([]); }} className="text-zinc-600 hover:text-zinc-400 transition text-xs">✕</button>
            )}
          </div>

          {results.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-zinc-900 border border-white/8 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
              {results.map((r, i) => (
                <button key={i} onClick={() => goToResult(r)}
                  className="w-full text-left flex gap-3 px-3 py-2.5 hover:bg-zinc-800 transition border-b border-white/5 last:border-0">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-amber-500 uppercase tracking-wider">
                        {DOCS.find(d => d.id === r.doc)?.label}
                      </span>
                      <span className="text-[10px] text-zinc-600">p.{r.page}</span>
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-1">{r.excerpt}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Page indicator + quick jump */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 shrink-0">
          <span className="text-zinc-300">{currentPage}</span>
          <span className="text-zinc-700">/</span>
          <span>{totalPages || "—"}</span>
          <button onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="ml-2 w-6 h-6 flex items-center justify-center rounded-lg bg-zinc-900 border border-white/5 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition">‹</button>
          <button onClick={() => scrollToPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="w-6 h-6 flex items-center justify-center rounded-lg bg-zinc-900 border border-white/5 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition">›</button>
        </div>
      </div>

      {/* ── Scrollable page stack ────────────────────────────────────────── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-6"
      >
        {!pdfDoc && (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 rounded-full border-2 border-zinc-700 border-t-amber-400 animate-spin" />
          </div>
        )}

        {pdfDoc && (
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {Array.from({ length: totalPages }, (_, i) => (
              <div key={i + 1}
                ref={(el) => { pageContainerRefs.current[i] = el; }}
                className="flex flex-col gap-1">
                <div className="text-[10px] text-zinc-600 text-right select-none">p.{i + 1}</div>
                <PageCanvas pdfDoc={pdfDoc} pageNum={i + 1} width={width} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
