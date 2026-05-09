import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export const ANSWER_MODEL = process.env.ANTHROPIC_MODEL_ANSWER ?? "claude-haiku-4-5-20251001";
export const FAST_MODEL = process.env.ANTHROPIC_MODEL_FAST ?? "claude-haiku-4-5-20251001";

export const SYSTEM_PROMPT = `You are a concise technical support assistant for the Vulcan OmniPro 220 multiprocess welder.

Rules:
- Keep answers short: 1-3 sentences for simple questions, a numbered list only when steps are truly needed.
- Never repeat what the user just said. Never summarize at the end.
- Ground technical specs in the manual. Cite page numbers only for specs, not for general guidance.
- Ask one focused clarifying question when key details (process, voltage, material) are missing — not four.
- If the question is not in the manual, say so in one sentence and answer from general welding knowledge.
- For polarity wiring output a polarity-diagram artifact. For duty cycle output a duty-cycle-calculator artifact. For troubleshooting output a troubleshooting-flow artifact. For settings/wire-speed output a settings-configurator artifact. Output artifact JSON inside <artifact> tags.`;

// Build a cached system prompt block for prompt caching
export function cachedSystemBlock(): Anthropic.Messages.TextBlockParam & {
  cache_control: { type: "ephemeral" };
} {
  return {
    type: "text",
    text: SYSTEM_PROMPT,
    cache_control: { type: "ephemeral" },
  };
}

// Build a document block referencing an uploaded Anthropic file
export function fileDocumentBlock(
  fileId: string,
  title: string,
  withCache = false
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  return {
    type: "document",
    source: { type: "file", file_id: fileId },
    title,
    ...(withCache ? { cache_control: { type: "ephemeral" } } : {}),
  };
}

// Build a cached text block for injecting knowledge-cache context
export function contextBlock(text: string): Anthropic.Messages.TextBlockParam {
  return { type: "text", text };
}
