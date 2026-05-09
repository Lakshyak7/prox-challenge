import { simpleComplete } from "@/lib/provider";
import { parseJsonObject } from "@/lib/json";
import { storeSessionProfile, hasSessionProfile } from "@/lib/vector-store";
import type { GuidedSessionPage } from "@/lib/types";

const PREFETCH_SYSTEM = `You are a context analyst for the Vulcan OmniPro 220 welder support assistant.
Given the user's stated issue and goal, produce a JSON object with context that will be needed throughout the conversation.
Return ONLY the JSON — no prose, no markdown.`;

type PrefetchResult = {
  followUpQuestions: string[];
  partsTools: string[];
  safetyNotes: string[];
  relevantPages: GuidedSessionPage[];
};

export async function runContextPrefetch(sessionId: string, userGoal: string): Promise<void> {
  if (!sessionId || hasSessionProfile(sessionId)) return;

  const prompt = `User's issue and goal: "${userGoal}"

Return JSON:
{
  "followUpQuestions": ["3 specific questions the user will likely ask next"],
  "partsTools": ["consumables, cables, accessories, or tools they will need"],
  "safetyNotes": ["key safety steps relevant to this task"],
  "relevantPages": [
    { "doc": "owner-manual"|"quick-start-guide"|"selection-chart", "page": 14, "caption": "What is on this page" }
  ]
}

Rules:
- followUpQuestions: 3-5 questions, specific to their stated goal
- partsTools: list actual items (e.g. "ER70S-6 wire", "0.030 contact tip", "CO2/Argon mix gas")
- safetyNotes: 2-4 concise notes
- relevantPages: 2-4 pages most relevant to their goal. Only include real OmniPro 220 manual pages.
  Key pages: owner-manual p.4 (controls overview), p.8 (quick start), p.13 (flux-core polarity),
  p.14 (MIG polarity), p.24 (TIG), p.37 (troubleshooting). quick-start-guide p.1 (setup).`;

  try {
    const raw = await simpleComplete(PREFETCH_SYSTEM, prompt, 700);
    const parsed = parseJsonObject<PrefetchResult>(raw);
    if (!parsed) return;

    storeSessionProfile(sessionId, {
      goal: userGoal,
      followUpQuestions: Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions.slice(0, 5) : [],
      partsTools: Array.isArray(parsed.partsTools) ? parsed.partsTools.slice(0, 8) : [],
      safetyNotes: Array.isArray(parsed.safetyNotes) ? parsed.safetyNotes.slice(0, 4) : [],
      relevantPages: Array.isArray(parsed.relevantPages) ? parsed.relevantPages.slice(0, 4) : [],
      prefetchedAt: new Date().toISOString(),
    });
  } catch {
    // Non-critical — pipeline continues without prefetch data
  }
}
