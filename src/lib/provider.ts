/**
 * Unified provider abstraction.
 * Uses Anthropic when ANTHROPIC_API_KEY is set, Gemini (via OpenAI-compat) when GEMINI_API_KEY is set.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./anthropic";

// ── Provider detection ───────────────────────────────────────────────────────

export type ProviderType = "anthropic" | "gemini";

export function getProviderType(): ProviderType {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  throw new Error("Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env");
}

const ANTHROPIC_ANSWER = process.env.ANTHROPIC_MODEL_ANSWER ?? "claude-haiku-4-5-20251001";
const ANTHROPIC_FAST = process.env.ANTHROPIC_MODEL_FAST ?? "claude-haiku-4-5-20251001";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

// ── Singleton clients ────────────────────────────────────────────────────────

let _anthropic: Anthropic | null = null;
let _openai: OpenAI | null = null;

function anthropic(): Anthropic {
  return (_anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
}

function gemini(): OpenAI {
  return (_openai ??= new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  }));
}

// ── Simple (non-streaming) completion — for classifier and validator ──────────

export async function simpleComplete(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 512
): Promise<string> {
  const provider = getProviderType();

  if (provider === "anthropic") {
    const res = await anthropic().messages.create({
      model: ANTHROPIC_FAST,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });
    return res.content[0].type === "text" ? res.content[0].text : "";
  }

  const res = await gemini().chat.completions.create({
    model: GEMINI_MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });
  return res.choices[0]?.message?.content ?? "";
}

// ── Stream types ─────────────────────────────────────────────────────────────

export type StreamChunk =
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string; id: string; input: Record<string, unknown> };

export type StreamAnswerOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  documentBlocks?: any[];    // Anthropic file/document blocks (ignored in Gemini mode)
  textContext?: string;      // Injected as text for both modes (knowledge cache excerpts)
  messages: { role: "user" | "assistant"; content: string }[];
  imageBase64?: string;
  imageMimeType?: string;
  tools?: {
    name: string;
    description: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input_schema: Record<string, any>;
  }[];
  // The latest user message is the last item in messages
};

// ── Streaming answer — main pipeline ────────────────────────────────────────

export async function* streamAnswer(options: StreamAnswerOptions): AsyncGenerator<StreamChunk> {
  const provider = getProviderType();
  if (provider === "anthropic") {
    yield* anthropicStreamAnswer(options);
  } else {
    yield* geminiStreamAnswer(options);
  }
}

// ── Anthropic streaming ──────────────────────────────────────────────────────

async function* anthropicStreamAnswer(options: StreamAnswerOptions): AsyncGenerator<StreamChunk> {
  const { cachedSystemBlock, fileDocumentBlock, contextBlock } = await import("./anthropic");

  // Build user content blocks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestUserContent: any[] = [];

  if (options.documentBlocks?.length) {
    latestUserContent.push(...options.documentBlocks);
  }
  if (options.textContext) {
    latestUserContent.push(contextBlock(`Knowledge cache context:\n${options.textContext}`));
  }
  if (options.imageBase64 && options.imageMimeType) {
    latestUserContent.push({
      type: "image",
      source: { type: "base64", media_type: options.imageMimeType, data: options.imageBase64 },
    });
  }

  const lastMsg = options.messages.at(-1);
  latestUserContent.push({ type: "text", text: lastMsg?.content ?? "" });

  const prior = options.messages.slice(0, -1).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const anthropicTools = options.tools?.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: { type: "object" as const, ...t.input_schema },
  }));

  // First pass — detect tool call
  const first = await anthropic().messages.create({
    model: ANTHROPIC_ANSWER,
    max_tokens: 2048,
    system: [cachedSystemBlock()],
    messages: [...prior, { role: "user", content: latestUserContent }],
    tools: anthropicTools?.length ? anthropicTools : undefined,
  });

  // Log cache hit rate for cost visibility
  if (process.env.NODE_ENV !== "production") {
    const u = first.usage as { cache_read_input_tokens?: number; cache_creation_input_tokens?: number; input_tokens: number };
    if ((u.cache_read_input_tokens ?? 0) > 0 || (u.cache_creation_input_tokens ?? 0) > 0) {
      console.log(`[cache] read=${u.cache_read_input_tokens ?? 0} created=${u.cache_creation_input_tokens ?? 0} uncached=${u.input_tokens}`);
    }
  }

  if (first.stop_reason === "tool_use") {
    const toolBlock = first.content.find((b) => b.type === "tool_use");
    if (toolBlock?.type === "tool_use") {
      yield { type: "tool_call", name: toolBlock.name, id: toolBlock.id, input: toolBlock.input as Record<string, unknown> };
      return;
    }
  }

  // Stream direct answer
  const stream = anthropic().messages.stream({
    model: ANTHROPIC_ANSWER,
    max_tokens: 2048,
    system: [cachedSystemBlock()],
    messages: [...prior, { role: "user", content: latestUserContent }],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { type: "text", text: event.delta.text };
    }
  }
}

// Stream after providing tool result (second pass for Anthropic)
export async function* anthropicStreamWithToolResult(
  options: StreamAnswerOptions,
  toolId: string,
  toolResult: string
): AsyncGenerator<StreamChunk> {
  const { cachedSystemBlock, contextBlock } = await import("./anthropic");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestUserContent: any[] = [];
  if (options.textContext) latestUserContent.push(contextBlock(`Knowledge cache:\n${options.textContext}`));
  if (options.documentBlocks?.length) latestUserContent.push(...options.documentBlocks);
  latestUserContent.push({ type: "text", text: options.messages.at(-1)?.content ?? "" });

  const prior = options.messages.slice(0, -1).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Reconstruct the assistant tool_use turn (typed explicitly to satisfy Anthropic SDK)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolTurn: any = {
    role: "assistant",
    content: [{ type: "tool_use" as const, id: toolId, name: "web_search", input: {} }],
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolResultTurn: any = {
    role: "user",
    content: [{ type: "tool_result" as const, tool_use_id: toolId, content: toolResult }],
  };

  const stream = anthropic().messages.stream({
    model: ANTHROPIC_ANSWER,
    max_tokens: 2048,
    system: [cachedSystemBlock()],
    messages: [
      ...prior,
      { role: "user", content: latestUserContent },
      toolTurn,
      toolResultTurn,
    ],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { type: "text", text: event.delta.text };
    }
  }
}

// ── Gemini streaming (via OpenAI compat) ─────────────────────────────────────

async function* geminiStreamAnswer(options: StreamAnswerOptions): AsyncGenerator<StreamChunk> {
  type OpenAIMsg = { role: "system" | "user" | "assistant"; content: string };

  const sysMsg: OpenAIMsg = { role: "system", content: SYSTEM_PROMPT };

  // Build context prefix for the latest user message
  let userPrefix = "";
  if (options.textContext) userPrefix += `[Manual context]\n${options.textContext}\n\n`;

  const msgs: OpenAIMsg[] = [
    sysMsg,
    ...options.messages.slice(0, -1).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const lastContent = userPrefix + (options.messages.at(-1)?.content ?? "");

  // Handle image inline for Gemini (base64 image_url)
  if (options.imageBase64 && options.imageMimeType) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (msgs as any[]).push({
      role: "user",
      content: [
        { type: "text", text: lastContent },
        { type: "image_url", image_url: { url: `data:${options.imageMimeType};base64,${options.imageBase64}` } },
      ],
    });
  } else {
    msgs.push({ role: "user", content: lastContent });
  }

  const geminiTools = options.tools?.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));

  // First pass — detect tool call
  const first = await gemini().chat.completions.create({
    model: GEMINI_MODEL,
    max_tokens: 2048,
    messages: msgs,
    tools: geminiTools?.length ? geminiTools : undefined,
    tool_choice: geminiTools?.length ? "auto" : undefined,
  });

  const firstChoice = first.choices[0];
  if (firstChoice?.finish_reason === "tool_calls") {
    const toolCall = firstChoice.message.tool_calls?.[0];
    if (toolCall) {
      yield {
        type: "tool_call",
        name: toolCall.function.name,
        id: toolCall.id,
        input: JSON.parse(toolCall.function.arguments || "{}"),
      };
      return;
    }
  }

  // Stream direct answer
  const stream = await gemini().chat.completions.create({
    model: GEMINI_MODEL,
    max_tokens: 2048,
    messages: msgs,
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? "";
    if (text) yield { type: "text", text };
  }
}

// Stream after providing Gemini tool result
export async function* geminiStreamWithToolResult(
  options: StreamAnswerOptions,
  toolCallId: string,
  toolName: string,
  toolResult: string
): AsyncGenerator<StreamChunk> {
  type OpenAIMsg = OpenAI.ChatCompletionMessageParam;
  const sysMsg: OpenAIMsg = { role: "system", content: SYSTEM_PROMPT };
  let userPrefix = "";
  if (options.textContext) userPrefix += `[Manual context]\n${options.textContext}\n\n`;

  const msgs: OpenAIMsg[] = [
    sysMsg,
    ...options.messages.slice(0, -1).map((m) => ({ role: m.role as "user" | "assistant", content: m.content } as OpenAIMsg)),
    { role: "user", content: userPrefix + (options.messages.at(-1)?.content ?? "") },
    {
      role: "assistant",
      content: null,
      tool_calls: [{ id: toolCallId, type: "function", function: { name: toolName, arguments: "{}" } }],
    },
    { role: "tool", tool_call_id: toolCallId, content: toolResult },
  ];

  const stream = await gemini().chat.completions.create({
    model: GEMINI_MODEL,
    max_tokens: 2048,
    messages: msgs,
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? "";
    if (text) yield { type: "text", text };
  }
}

export { anthropic, gemini };
export { ANTHROPIC_ANSWER as ANSWER_MODEL, ANTHROPIC_FAST as FAST_MODEL };
