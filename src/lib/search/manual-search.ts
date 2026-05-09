import { getKnowledgeCache } from "@/lib/cache/knowledge-cache";
import type { GuidedSessionPage } from "@/lib/types";

export type ManualSearchResult = {
  doc: GuidedSessionPage["doc"];
  page: number;
  excerpt: string;
  score: number;
};

const DOC_KEYS: Array<{ key: "ownerManual" | "quickStartGuide" | "selectionChart"; doc: GuidedSessionPage["doc"] }> = [
  { key: "ownerManual",      doc: "owner-manual" },
  { key: "quickStartGuide",  doc: "quick-start-guide" },
  { key: "selectionChart",   doc: "selection-chart" },
];

function chunkByPage(text: string, approxCharsPerPage = 2800): Array<{ page: number; text: string }> {
  const chunks: Array<{ page: number; text: string }> = [];
  let pos = 0, page = 1;
  while (pos < text.length) {
    chunks.push({ page, text: text.slice(pos, pos + approxCharsPerPage) });
    pos += approxCharsPerPage;
    page++;
  }
  return chunks;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
}

function tfidfScore(queryTokens: string[], docTokens: string[]): number {
  const docSet = new Set(docTokens);
  const tf: Record<string, number> = {};
  for (const t of docTokens) tf[t] = (tf[t] ?? 0) + 1;

  let score = 0;
  for (const qt of queryTokens) {
    if (docSet.has(qt)) score += (tf[qt] ?? 0) / docTokens.length;
    if (qt.length > 4 && docTokens.includes(qt)) score += 0.05;
  }
  return score;
}

export function searchManual(query: string, maxResults = 6): ManualSearchResult[] {
  if (!query.trim()) return [];

  const cache = getKnowledgeCache();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawText = (cache as any)._rawText as Record<string, string> | undefined;
  if (!rawText) return [];

  const queryTokens = tokenize(query);
  const results: ManualSearchResult[] = [];

  for (const { key, doc } of DOC_KEYS) {
    const text = rawText[key];
    if (!text) continue;

    for (const chunk of chunkByPage(text)) {
      const docTokens = tokenize(chunk.text);
      const score = tfidfScore(queryTokens, docTokens);
      if (score > 0.01) {
        const lc = chunk.text.toLowerCase();
        let excerptStart = 0;
        for (const qt of queryTokens) {
          const idx = lc.indexOf(qt);
          if (idx !== -1) { excerptStart = Math.max(0, idx - 60); break; }
        }
        const raw = chunk.text.slice(excerptStart, excerptStart + 220).replace(/\s+/g, " ").trim();
        results.push({ doc, page: chunk.page, excerpt: raw + (raw.length >= 219 ? "…" : ""), score });
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}

/** Format results as plain text for the model's tool result. */
export function formatManualResults(results: ManualSearchResult[], query: string): string {
  if (!results.length) return `No manual content found for "${query}".`;

  const lines = results.map((r, i) => {
    const docLabel = r.doc === "owner-manual" ? "Owner Manual" : r.doc === "quick-start-guide" ? "Quick Start Guide" : "Selection Chart";
    return `[${i + 1}] ${docLabel}, p.${r.page}\n"${r.excerpt}"`;
  });
  return `Manual search results for "${query}":\n\n${lines.join("\n\n")}`;
}

/** Convert top results to inline page references. Deduplicates by doc+page. */
export function resultsToPages(results: ManualSearchResult[], max = 3): GuidedSessionPage[] {
  const seen = new Set<string>();
  const pages: GuidedSessionPage[] = [];
  for (const r of results) {
    const key = `${r.doc}:${r.page}`;
    if (!seen.has(key)) {
      seen.add(key);
      pages.push({ doc: r.doc, page: r.page, caption: r.excerpt.slice(0, 120) });
      if (pages.length >= max) break;
    }
  }
  return pages;
}
