import { simpleComplete } from "@/lib/provider";
import { parseJsonObject } from "@/lib/json";
import type { Classification, IntentType, AnswerSource, ToneType, WeldProcess } from "@/lib/types";

const CLASSIFIER_PROMPT = `You classify user questions about the Vulcan OmniPro 220 welder.

Respond with JSON only — no explanation. Schema:
{
  "intent": one of: "setup" | "troubleshooting" | "polarity" | "duty-cycle" | "settings" | "part-identification" | "safety" | "general-explanation" | "out-of-manual",
  "source": one of: "manual" | "general" | "web",
  "tone": one of: "confused" | "frustrated" | "urgent" | "curious" | "confident",
  "topic": "short normalized topic key, e.g. polarity_tig, duty_cycle_240v, er70s6_wire",
  "process": one of: "mig" | "flux-core" | "tig" | "stick" | null
}

Source routing rules:
- "manual": question maps to owner manual, quick-start guide, or selection chart content
- "general": welding/electrical topic the manual doesn't cover (metallurgy, technique theory, general consumables)
- "web": needs current data — adapters, third-party accessories, part numbers, compatibility, comparisons`;

export async function classifyIntent(message: string): Promise<Classification> {
  const local = classifyLocally(message);
  if (local) return local;

  const raw = await simpleComplete(CLASSIFIER_PROMPT, message, 256);

  const parsed = parseJsonObject<{
      intent: IntentType;
      source: AnswerSource;
      tone: ToneType;
      topic: string;
      process: WeldProcess | null;
    }>(raw);

  if (parsed) {
    return {
      intent: parsed.intent ?? "general-explanation",
      source: parsed.source ?? "manual",
      tone: parsed.tone ?? "curious",
      topic: parsed.topic ?? "general",
      process: parsed.process ?? undefined,
    };
  }

  return { intent: "general-explanation", source: "manual", tone: "curious", topic: "general" };
}

function classifyLocally(message: string): Classification | null {
  const text = message.toLowerCase();
  const process = detectProcess(text);

  if (text.includes("polarity") || text.includes("which socket") || text.includes("ground clamp")) {
    return {
      intent: "polarity",
      source: "manual",
      tone: "curious",
      topic: process ? `polarity_${process}` : "polarity",
      process,
    };
  }

  if (text.includes("duty cycle")) {
    return {
      intent: "duty-cycle",
      source: "manual",
      tone: "curious",
      topic: "duty_cycle",
      process,
    };
  }

  if (text.includes("porosity") || text.includes("holes in") || text.includes("small cavities")) {
    return {
      intent: "troubleshooting",
      source: "manual",
      tone: text.includes("frustrated") || text.includes("keeps") ? "frustrated" : "curious",
      topic: "porosity",
      process,
    };
  }

  if (text.includes("dinse") || text.includes("adapter")) {
    return {
      intent: "out-of-manual",
      source: "web",
      tone: "curious",
      topic: "dinse_adapter",
      process,
    };
  }

  return null;
}

function detectProcess(text: string): WeldProcess | undefined {
  if (text.includes("flux")) return "flux-core";
  if (text.includes("tig")) return "tig";
  if (text.includes("stick")) return "stick";
  if (text.includes("mig")) return "mig";
  return undefined;
}
