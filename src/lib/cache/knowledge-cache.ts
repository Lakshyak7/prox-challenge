import fs from "fs";
import path from "path";
import type { KnowledgeCache, AdjacentCacheEntry, PrecomputedAnswer, IntentType, WeldProcess } from "@/lib/types";

const CACHE_PATH = path.join(process.cwd(), "data", "knowledge-cache.json");

export function getKnowledgeCache(): KnowledgeCache {
  if (!fs.existsSync(CACHE_PATH)) {
    return { polarity: {}, dutyCycle: {}, troubleshooting: {}, settings: {}, adjacent: {}, precomputed: {} };
  }
  return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8")) as KnowledgeCache;
}

// Find a precomputed answer by word-overlap similarity (no API cost)
export function findPrecomputedAnswer(query: string): PrecomputedAnswer | null {
  const cache = getKnowledgeCache();
  if (!cache.precomputed) return null;
  const qWords = new Set(query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3));
  let best: PrecomputedAnswer | null = null;
  let bestScore = 0.4; // require at least 40% word overlap
  for (const entry of Object.values(cache.precomputed)) {
    const qWords2 = new Set(entry.question.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3));
    const intersection = [...qWords].filter((w) => qWords2.has(w)).length;
    const score = intersection / Math.max(qWords.size, qWords2.size, 1);
    if (score > bestScore) { bestScore = score; best = entry; }
  }
  return best;
}

export function saveKnowledgeCache(cache: KnowledgeCache): void {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

export function updateAdjacentCache(key: string, entry: AdjacentCacheEntry): void {
  const cache = getKnowledgeCache();
  cache.adjacent[key] = entry;
  saveKnowledgeCache(cache);
}

// Returns a formatted string of relevant cache context for injection into prompts
export function buildContextSnippet(intent: IntentType, process?: WeldProcess): string {
  const cache = getKnowledgeCache();
  const parts: string[] = [];

  if (intent === "polarity" && process) {
    const entry = cache.polarity[process];
    if (entry) {
      parts.push(`[CACHED POLARITY — ${process.toUpperCase()}]\n${entry.summary}\nSource pages: ${entry.sourcePages.join(", ")}`);
    }
  }

  if (intent === "duty-cycle") {
    const v120 = cache.dutyCycle["120v"];
    const v240 = cache.dutyCycle["240v"];
    if (v120) parts.push(`[CACHED DUTY CYCLE — 120V]\nSource pages: ${v120.sourcePages.join(", ")}`);
    if (v240) parts.push(`[CACHED DUTY CYCLE — 240V]\nSource pages: ${v240.sourcePages.join(", ")}`);
  }

  return parts.join("\n\n");
}

// Look up an adjacent cache entry by normalized topic key
export function getAdjacentEntry(key: string): AdjacentCacheEntry | null {
  const cache = getKnowledgeCache();
  return cache.adjacent[key] ?? null;
}
