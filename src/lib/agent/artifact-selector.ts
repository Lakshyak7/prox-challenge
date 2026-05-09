import type { AgentArtifact, Classification, KnowledgeCache, WeldProcess } from "@/lib/types";
import { getKnowledgeCache } from "@/lib/cache/knowledge-cache";
import { parseJsonObject } from "@/lib/json";

// Attempt to extract an <artifact> tag from the model response text
export function extractArtifactFromResponse(text: string): { cleanText: string; artifact: AgentArtifact | null } {
  const match = text.match(/<artifact>([\s\S]*?)<\/artifact>/i);
  if (!match) return { cleanText: text, artifact: null };

  const cleanText = text.replace(match[0], "").trim();
  const artifact = parseJsonObject<AgentArtifact>(match[1]) ?? null;
  return { cleanText, artifact: artifact && isValidArtifact(artifact) ? artifact : null };
}

// Select a pre-built artifact from knowledge cache for accuracy-critical types
export function selectPrebuiltArtifact(classification: Classification): AgentArtifact | null {
  const cache = getKnowledgeCache();

  switch (classification.intent) {
    case "polarity":
      return buildPolarityArtifact(cache, classification.process);
    case "duty-cycle":
      return buildDutyCycleArtifact(cache);
    case "troubleshooting":
      return buildTroubleshootingArtifact(cache, classification.topic);
    case "settings":
      return buildSettingsArtifact(cache, classification.topic);
    default:
      return null;
  }
}

function buildPolarityArtifact(cache: KnowledgeCache, process?: WeldProcess): AgentArtifact | null {
  if (!process) return null;
  const entry = cache.polarity[process];
  if (!entry || !isPolarityConnections(entry.connections)) return null;
  return { type: "polarity-diagram", process, connections: entry.connections };
}

function buildDutyCycleArtifact(cache: KnowledgeCache): AgentArtifact | null {
  const v240 = cache.dutyCycle["240v"];
  const v120 = cache.dutyCycle["120v"];
  if (!v240 && !v120) return null;

  const table = [...(v120?.table ?? []), ...(v240?.table ?? [])];
  return {
    type: "duty-cycle-calculator",
    defaults: { process: "mig", voltage: "240v", amperage: 130 },
    table,
  };
}

function buildTroubleshootingArtifact(cache: KnowledgeCache, topic: string): AgentArtifact | null {
  const entry = cache.troubleshooting[topic];
  if (!entry) return null;
  return { type: "troubleshooting-flow", issue: topic, steps: entry.checks };
}

function buildSettingsArtifact(cache: KnowledgeCache, topic: string): AgentArtifact | null {
  const entry = cache.settings[topic] ?? cache.settings["mild_steel_mig"];
  if (!entry) return null;
  return { type: "settings-configurator", defaults: {} };
}

function isPolarityConnections(value: unknown): value is NonNullable<KnowledgeCache["polarity"][WeldProcess]>["connections"] {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    (item.electrode === "positive" || item.electrode === "negative") &&
    (item.work === "positive" || item.work === "negative") &&
    typeof item.torchSocket === "string" &&
    typeof item.workSocket === "string"
  );
}

function isValidArtifact(artifact: AgentArtifact): boolean {
  if (artifact.type === "polarity-diagram") return isPolarityConnections(artifact.connections);
  if (artifact.type === "duty-cycle-calculator") return Array.isArray(artifact.table);
  if (artifact.type === "troubleshooting-flow") return Array.isArray(artifact.steps);
  if (artifact.type === "code") return typeof artifact.code === "string";
  if (artifact.type === "guided-session") return Array.isArray(artifact.steps) && artifact.steps.length > 0;
  return true;
}
