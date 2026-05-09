import { simpleComplete } from "@/lib/provider";
import { buildContextSnippet } from "@/lib/cache/knowledge-cache";
import { parseJsonObject } from "@/lib/json";
import type { Classification, ValidationResult, AgentResponse, Confidence } from "@/lib/types";

const VALIDATOR_PROMPT = `You are verifying a candidate answer about the Vulcan OmniPro 220 welder.
Below is the candidate answer, followed by relevant excerpts from the product manual.

Identify ONLY real issues — do not invent conflicts. Respond in JSON only. Schema:
{
  "conflicts": [{ "candidateClaim": "...", "manualSpec": "...", "manualPage": number | null }],
  "corroborations": [{ "claim": "...", "manualPage": number, "document": "..." }],
  "safetyGaps": [{ "description": "...", "manualNote": "...", "manualPage": number | null, "severity": "critical" | "warning" | "info" }]
}`;

export async function validateAgainstManual(
  candidate: string,
  classification: Classification
): Promise<ValidationResult> {
  const context = buildContextSnippet(classification.intent, classification.process);

  if (!context) {
    return { conflicts: [], corroborations: [], safetyGaps: [] };
  }

  const userMessage = `Candidate answer:\n<candidate>\n${candidate}\n</candidate>\n\nManual excerpts (topic: ${classification.topic}):\n<manual>\n${context}\n</manual>`;
  const raw = await simpleComplete(VALIDATOR_PROMPT, userMessage, 512);

  return parseJsonObject<ValidationResult>(raw) ?? { conflicts: [], corroborations: [], safetyGaps: [] };
}

export function applyValidation(
  text: string,
  confidence: Confidence,
  source: "general" | "web",
  result: ValidationResult
): { text: string; confidence: Confidence; sourceLabel: string; citations: AgentResponse["citations"] } {
  let mutatedText = text;
  let mutatedConfidence = confidence;
  const citations: AgentResponse["citations"] = [];

  for (const c of result.conflicts) {
    mutatedText += `\n\n> **Note:** This source states "${c.candidateClaim}" — however, the Vulcan OmniPro 220 manual specifies: **${c.manualSpec}**. Follow the manual.`;
    if (c.manualPage) citations.push({ document: "Owner Manual", page: c.manualPage, label: "Manual specification" });
  }

  for (const c of result.corroborations) {
    citations.push({ document: c.document, page: c.manualPage, label: `Consistent with manual: ${c.claim}` });
  }

  for (const gap of result.safetyGaps) {
    mutatedText += `\n\n> ⚠️ **Safety note (from manual):** ${gap.manualNote}`;
    if (gap.severity === "critical" || gap.severity === "warning") mutatedConfidence = "low";
    if (gap.manualPage) citations.push({ document: "Owner Manual", page: gap.manualPage, label: "Safety requirement" });
  }

  const hasConflict = result.conflicts.length > 0;
  const sourceLabel =
    source === "web"
      ? hasConflict ? "Web source — corrected against manual" : "From web search"
      : hasConflict ? "General knowledge — manual spec applied" : "General knowledge";

  return { text: mutatedText, confidence: mutatedConfidence, sourceLabel, citations };
}
