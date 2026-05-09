/**
 * Lightweight in-memory TF-IDF vector store for session-scoped context deduplication.
 * Stores retrieved manual context chunks so follow-up queries can reuse them
 * without redundant retrieval.
 */

import type { GuidedSessionPage } from "@/lib/types";

type ContextEntry = {
  text: string;
  intent: string;
  topic: string;
  tf: Map<string, number>;
};

const sessions = new Map<string, ContextEntry[]>();

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 2);
}

function buildTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

function cosineSim(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, normA = 0, normB = 0;
  for (const [k, v] of a) {
    dot += v * (b.get(k) ?? 0);
    normA += v * v;
  }
  for (const [, v] of b) normB += v * v;
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function storeContext(sessionId: string, text: string, intent: string, topic: string): void {
  if (!sessionId || !text.trim()) return;
  const entries = sessions.get(sessionId) ?? [];
  entries.push({ text, intent, topic, tf: buildTF(tokenize(text)) });
  if (entries.length > 20) entries.shift();
  sessions.set(sessionId, entries);
}

export function findSimilarContext(sessionId: string, query: string, threshold = 0.3): string | null {
  if (!sessionId) return null;
  const entries = sessions.get(sessionId);
  if (!entries?.length) return null;
  const qTF = buildTF(tokenize(query));
  let best: ContextEntry | null = null;
  let bestScore = threshold;
  for (const entry of entries) {
    const score = cosineSim(qTF, entry.tf);
    if (score > bestScore) { bestScore = score; best = entry; }
  }
  return best?.text ?? null;
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
  sessionProfiles.delete(sessionId);
}

// ─── Session profile (context prefetch results) ───────────────────────────────

export type SessionProfile = {
  goal: string;
  followUpQuestions: string[];
  partsTools: string[];
  safetyNotes: string[];
  relevantPages: GuidedSessionPage[];
  prefetchedAt: string;
};

const sessionProfiles = new Map<string, SessionProfile>();

export function storeSessionProfile(sessionId: string, profile: SessionProfile): void {
  if (!sessionId) return;
  sessionProfiles.set(sessionId, profile);
}

export function getSessionProfile(sessionId: string): SessionProfile | null {
  if (!sessionId) return null;
  return sessionProfiles.get(sessionId) ?? null;
}

export function hasSessionProfile(sessionId: string): boolean {
  return sessionProfiles.has(sessionId);
}
