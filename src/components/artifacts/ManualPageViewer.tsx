"use client";

import { useEffect, useRef, useState } from "react";
import type { GuidedSessionPage } from "@/lib/types";
import type { Doc } from "@/components/manual/PdfViewer";

const PDFJS_VERSION = "3.11.174";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

const DOC_LABEL: Record<GuidedSessionPage["doc"], string> = {
  "owner-manual": "Owner Manual",
  "quick-start-guide": "Quick Start Guide",
  "selection-chart": "Selection Chart",
};

// Load pdfjs once globally from CDN
let pdfJsLoaded: Promise<void> | null = null;
function ensurePdfJs(): Promise<void> {
  if (pdfJsLoaded) return pdfJsLoaded;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).pdfjsLib) return (pdfJsLoaded = Promise.resolve());
  pdfJsLoaded = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${PDFJS_CDN}/pdf.min.js`;
    s.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      resolve();
    };
    s.onerror = () => reject(new Error("Failed to load pdfjs"));
    document.head.appendChild(s);
  });
  return pdfJsLoaded;
}

function PdfPageCanvas({ doc, page, caption, onOpenManualPage }: GuidedSessionPage & { onOpenManualPage?: (doc: Doc, page: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const pdfUrl = `/api/manual/${doc}`;
  const label = DOC_LABEL[doc];

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        await ensurePdfJs();
        if (cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfjsLib = (window as any).pdfjsLib;
        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
        if (cancelled) return;

        const pdfPage = await pdf.getPage(page);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const containerWidth = canvas.parentElement?.clientWidth ?? 640;
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const scale = containerWidth / baseViewport.width;
        const viewport = pdfPage.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        await pdfPage.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) { setError(true); setLoading(false); }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [pdfUrl, page]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-36 gap-2 bg-zinc-900 rounded-xl">
        <p className="text-xs text-zinc-500">Preview unavailable</p>
        {onOpenManualPage ? (
          <button onClick={() => onOpenManualPage(doc as Doc, page)}
            className="text-xs text-amber-400 hover:text-amber-300 underline transition">
            Open {label} p.{page} →
          </button>
        ) : (
          <a href={`${pdfUrl}#page=${page}`} target="_blank" rel="noreferrer"
            className="text-xs text-amber-400 hover:text-amber-300 underline transition">
            Open {label} p.{page} ↗
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-white/8 bg-zinc-950">
      {loading && (
        <div className="animate-pulse bg-zinc-800" style={{ height: 300 }} />
      )}
      <canvas
        ref={canvasRef}
        className="w-full block"
        style={{ display: loading ? "none" : "block" }}
      />
      <div className="flex items-center justify-between px-3 py-2 border-t border-white/5 bg-zinc-900/60">
        {caption ? (
          <p className="text-[11px] text-zinc-400 flex-1 leading-snug">{caption}</p>
        ) : (
          <p className="text-[11px] text-zinc-500">{label} — p.{page}</p>
        )}
        {onOpenManualPage ? (
          <button
            onClick={() => onOpenManualPage(doc as Doc, page)}
            className="text-[10px] text-amber-500 hover:text-amber-400 transition ml-3 shrink-0"
          >
            {label} p.{page} →
          </button>
        ) : (
          <a href={`${pdfUrl}#page=${page}`} target="_blank" rel="noreferrer"
            className="text-[10px] text-amber-500 hover:text-amber-400 transition ml-3 shrink-0">
            Open ↗
          </a>
        )}
      </div>
    </div>
  );
}

type Props = { pages: GuidedSessionPage[]; onOpenManualPage?: (doc: Doc, page: number) => void };

export default function ManualPageViewer({ pages, onOpenManualPage }: Props) {
  if (!pages.length) return null;

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
        Manual Reference
      </h3>
      {pages.map((entry) => (
        <PdfPageCanvas key={`${entry.doc}-${entry.page}`} {...entry} onOpenManualPage={onOpenManualPage} />
      ))}
    </div>
  );
}
