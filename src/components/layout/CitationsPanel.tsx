import type { Citation } from "@/lib/types";
import type { Doc } from "@/components/manual/PdfViewer";

type Props = {
  citations: Citation[];
  onOpenManualPage?: (doc: Doc, page: number) => void;
};

function docNameToId(document: string): Doc {
  const d = document.toLowerCase();
  if (d.includes("quick") || d.includes("start")) return "quick-start-guide";
  if (d.includes("selection") || d.includes("chart")) return "selection-chart";
  return "owner-manual";
}

export default function CitationsPanel({ citations, onOpenManualPage }: Props) {
  if (!citations.length) return null;

  return (
    <div className="border-t border-zinc-800 pt-3">
      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Sources</h4>
      <ul className="flex flex-col gap-1.5">
        {citations.map((c, i) => (
          <li key={i} className="flex gap-2 items-start text-xs text-zinc-400">
            <span className="text-zinc-600 shrink-0">›</span>
            <span className="flex flex-col gap-0.5">
              {c.url ? (
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  {c.label || c.document}
                </a>
              ) : (
                <span className="text-zinc-300">{c.document}</span>
              )}
              {c.label && !c.url && <span className="text-zinc-500">{c.label}</span>}
              {c.page && onOpenManualPage ? (
                <button
                  onClick={() => onOpenManualPage(docNameToId(c.document), c.page!)}
                  className="text-left text-amber-600 hover:text-amber-400 transition"
                >
                  p.{c.page} — View in manual →
                </button>
              ) : c.page ? (
                <span className="text-zinc-600">p.{c.page}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
