import {
  streamAnswer,
  anthropicStreamWithToolResult,
  geminiStreamWithToolResult,
  getProviderType,
  simpleComplete,
} from "@/lib/provider";
import { parseJsonObject } from "@/lib/json";
import { classifyIntent } from "./classifier";
import { validateAgainstManual, applyValidation } from "./validator";
import { retrieveContext } from "./retriever";
import { extractArtifactFromResponse, selectPrebuiltArtifact } from "./artifact-selector";
import { updateAdjacentCache, getAdjacentEntry, findPrecomputedAnswer } from "@/lib/cache/knowledge-cache";
import { getKnowledgeCache } from "@/lib/cache/knowledge-cache";
import { webSearch, isWebSearchAvailable } from "@/lib/search/web-search";
import { searchManual, formatManualResults, resultsToPages } from "@/lib/search/manual-search";
import { storeContext, findSimilarContext, getSessionProfile } from "@/lib/vector-store";
import { runContextPrefetch } from "./context-prefetch";
import type { PipelineRequest, StreamEvent, AgentResponse, Confidence, SupportMode, GuidedStep, AgentArtifact } from "@/lib/types";

const WEB_SEARCH_TOOL = {
  name: "web_search",
  description:
    "Search the web for current product information, compatibility data, consumable specs, or welding knowledge not covered in the Vulcan OmniPro 220 manuals.",
  input_schema: {
    type: "object" as const,
    properties: { query: { type: "string", description: "Search query" } },
    required: ["query"],
  },
};

const MANUAL_SEARCH_TOOL = {
  name: "manual_search",
  description:
    "Search the Vulcan OmniPro 220 owner manual, quick start guide, and selection chart for exact specifications, procedures, settings, or troubleshooting steps. Use this whenever you need to cite a specific page, find wiring instructions, polarity setup, duty cycle data, or any technical detail from the manual. Always prefer this over guessing.",
  input_schema: {
    type: "object" as const,
    properties: { query: { type: "string", description: "Keywords to search for in the manual" } },
    required: ["query"],
  },
};

// Short filler phrases for voice mode — give instant perceived response while pipeline runs
const VOICE_FILLERS = [
  "Let me check the manual for that.",
  "One sec, looking that up.",
  "Sure, let me find that.",
  "Checking now.",
];

export async function* runAgentPipeline(request: PipelineRequest): AsyncGenerator<StreamEvent> {
  const userMessage = request.voiceTranscript ?? request.messages.at(-1)?.content ?? "";
  const mode = request.mode ?? "using";
  const sessionId = request.sessionId ?? "";

  // ── Context prefetch: fire on first user message, runs in parallel with the stream ──
  const isFirstUserMessage = request.messages.filter((m) => m.role === "user").length === 1;
  const prefetchPromise: Promise<void> = isFirstUserMessage && sessionId
    ? runContextPrefetch(sessionId, userMessage)
    : Promise.resolve();

  // ── Prompt sanity check ──────────────────────────────────────────────────
  // Skip for short acks and the very first context-gathering message
  if (!isFirstUserMessage && !isConversationalReply(userMessage)) {
    const sanity = await checkPromptSanity(userMessage);
    if (!sanity.ok) {
      yield { type: "text", chunk: sanity.redirect ?? "Could you rephrase that? I'm here to help with the Vulcan OmniPro 220 welder." };
      yield { type: "metadata", data: { source: "general", sourceLabel: "Out of scope", citations: [], confidence: "low", followUpQuestions: [] } };
      return;
    }
  }

  // ── Speculative streaming: instant filler for voice to reduce perceived latency ──
  // Skip on first message — we don't want "Let me check the manual" before the context-gathering reply
  if (request.voiceTranscript && !isFirstUserMessage) {
    const filler = VOICE_FILLERS[Math.floor(Math.random() * VOICE_FILLERS.length)];
    yield { type: "text", chunk: filler + " " };
  }

  // ── Precomputed FAQ hit ─────────────────────────────────────────────────
  const precomputed = findPrecomputedAnswer(userMessage);
  if (precomputed) {
    yield { type: "text", chunk: precomputed.answer };
    yield {
      type: "metadata",
      data: {
        source: "manual",
        sourceLabel: "From manual (pre-cached)",
        citations: precomputed.citations,
        confidence: "high",
        followUpQuestions: [],
        transcript: request.voiceTranscript ? { heard: request.voiceTranscript } : undefined,
      },
    };
    return;
  }

  // ── Classify ─────────────────────────────────────────────────────────────
  const classification = await classifyIntent(userMessage);

  // ── Adjacent cache hit ───────────────────────────────────────────────────
  if (classification.source !== "manual") {
    const cached = getAdjacentEntry(classification.topic);
    if (cached?.validated) {
      yield { type: "text", chunk: cached.summary };
      yield {
        type: "metadata",
        data: {
          source: cached.source,
          sourceLabel: cached.source === "web" ? "From web search (cached)" : "General knowledge (cached)",
          citations: cached.url ? [{ document: "Web", label: cached.url, url: cached.url }] : [],
          confidence: "medium",
          followUpQuestions: [],
        },
      };
      return;
    }
  }

  // ── Retrieve context ─────────────────────────────────────────────────────
  // Check session vector store first — reuse already-retrieved context for similar queries
  const cachedContext = findSimilarContext(sessionId, userMessage);
  const { documentBlocks, contextText: freshContext } = retrieveContext(classification);
  const contextText = cachedContext ?? freshContext;
  // Store the freshly retrieved context for future similar queries in this session
  if (!cachedContext && freshContext) storeContext(sessionId, freshContext, classification.intent, classification.topic);

  const deterministic = buildDeterministicManualResponse(classification, mode);
  if (deterministic) {
    yield { type: "text", chunk: deterministic.text };
    yield {
      type: "metadata",
      data: {
        source: "manual",
        sourceLabel: "From manual",
        citations: deterministic.citations,
        confidence: "high",
        followUpQuestions: [],
        artifact: deterministic.artifact,
        transcript: request.voiceTranscript ? { heard: request.voiceTranscript } : undefined,
      },
    };
    return;
  }

  const weldContextNote = request.weldContext
    ? `Current weld job context (user has told you this): ${request.weldContext.process.toUpperCase()} welding ${request.weldContext.material}, thickness ${request.weldContext.thicknessIn}" (${Math.round(request.weldContext.thicknessIn * 25.4)}mm)${request.weldContext.notes ? `, notes: ${request.weldContext.notes}` : ""}. Reference this context in your answer — give specific settings for this job.`
    : undefined;

  const tools = [
    MANUAL_SEARCH_TOOL,
    ...(isWebSearchAvailable() ? [WEB_SEARCH_TOOL] : []),
  ];

  const streamOptions = {
    documentBlocks,
    textContext: [modeInstruction(mode), contextText, weldContextNote].filter(Boolean).join("\n\n") || undefined,
    messages: request.messages,
    imageBase64: request.imageBase64,
    imageMimeType: request.imageMimeType,
    tools,
  };

  // ── Stream answer ────────────────────────────────────────────────────────
  let fullText = "";
  const provider = getProviderType();
  // Pages collected from manual_search tool calls — rendered inline in chat
  const searchedPages: import("@/lib/types").GuidedSessionPage[] = [];

  for await (const chunk of streamAnswer(streamOptions)) {
    if (chunk.type === "text") {
      fullText += chunk.text;
      yield { type: "text", chunk: chunk.text };
    }

    if (chunk.type === "tool_call") {
      let toolResult = "";
      const query = (chunk.input as { query: string }).query;

      if (chunk.name === "manual_search") {
        const results = searchManual(query);
        toolResult = formatManualResults(results, query);
        // Collect pages for inline rendering
        for (const p of resultsToPages(results, 3)) {
          if (!searchedPages.find((s) => s.doc === p.doc && s.page === p.page)) {
            searchedPages.push(p);
          }
        }
      } else if (chunk.name === "web_search") {
        const results = await webSearch(query);
        toolResult = results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join("\n\n");
      }

      const secondPassGen =
        provider === "anthropic"
          ? anthropicStreamWithToolResult(streamOptions, chunk.id, toolResult)
          : geminiStreamWithToolResult(streamOptions, chunk.id, chunk.name, toolResult);

      for await (const sc of secondPassGen) {
        if (sc.type === "text") {
          fullText += sc.text;
          yield { type: "text", chunk: sc.text };
        }
      }
    }
  }

  // ── Validate general/web answers ─────────────────────────────────────────
  let finalText = fullText;
  let confidence: Confidence = "high";
  let sourceLabel = "From manual";
  let extraCitations: AgentResponse["citations"] = [];

  if (classification.source !== "manual") {
    confidence = "medium";
    const validation = await validateAgainstManual(fullText, classification);
    const applied = applyValidation(fullText, confidence, classification.source, validation);
    finalText = applied.text;
    confidence = applied.confidence;
    sourceLabel = applied.sourceLabel;
    extraCitations = applied.citations;

    if (finalText !== fullText) {
      yield { type: "text", chunk: finalText.slice(fullText.length) };
    }

    updateAdjacentCache(classification.topic, {
      source: classification.source,
      summary: finalText,
      cachedAt: new Date().toISOString(),
      validated: true,
    });
  }

  // ── Select artifact ──────────────────────────────────────────────────────
  const { cleanText, artifact: codeArtifact } = extractArtifactFromResponse(finalText);

  // Strip artifact XML from the streamed message text — client already received it as chunks
  if (cleanText !== finalText) {
    yield { type: "text_replace", text: cleanText };
  }
  const prebuiltArtifact = !codeArtifact ? selectPrebuiltArtifact(classification) : null;

  // For setup questions without another artifact, generate a guided step-by-step session.
  // Skip on the first user message (user is still providing context to the welcome prompt)
  // and skip when the user is just acknowledging/waiting — don't restart the guide.
  let guidedArtifact: AgentArtifact | undefined;
  if (!codeArtifact && !prebuiltArtifact && classification.intent === "setup" && !isConversationalReply(userMessage) && !isFirstUserMessage) {
    guidedArtifact = await generateGuidedSession(userMessage, contextText) ?? undefined;
  }

  // If the model searched the manual, use those pages as the inline artifact
  // (unless a richer artifact like a diagram was already selected)
  const pageViewerArtifact: AgentArtifact | undefined =
    searchedPages.length > 0 ? { type: "manual-page-viewer", pages: searchedPages } : undefined;

  let artifact = codeArtifact ?? prebuiltArtifact ?? guidedArtifact ?? pageViewerArtifact ?? undefined;

  // ── Await prefetch + follow-up generation (ran in parallel with stream) ──
  const [followUpQuestions] = await Promise.all([
    generateFollowUpQuestions(finalText || fullText, classification.intent),
    prefetchPromise,
  ]);

  // Enrich guided-session artifact with pages from the session profile
  if (artifact?.type === "guided-session" && sessionId) {
    const profile = getSessionProfile(sessionId);
    if (profile?.relevantPages?.length && !artifact.pages?.length) {
      artifact = { ...artifact, pages: profile.relevantPages };
    }
  }

  // ── Emit metadata ─────────────────────────────────────────────────────────
  yield {
    type: "metadata",
    data: {
      source: classification.source,
      sourceLabel,
      citations: extraCitations,
      confidence,
      followUpQuestions,
      artifact,
      transcript: request.voiceTranscript ? { heard: request.voiceTranscript } : undefined,
    },
  };

}

function buildDeterministicManualResponse(classification: Awaited<ReturnType<typeof classifyIntent>>, mode: SupportMode): {
  text: string;
  citations: AgentResponse["citations"];
  artifact?: AgentResponse["artifact"];
} | null {
  const cache = getKnowledgeCache();
  const artifact = selectPrebuiltArtifact(classification) ?? undefined;

  if (classification.intent === "polarity" && classification.process) {
    const entry = cache.polarity[classification.process];
    if (!entry) return null;
    return {
      text: `${modeLeadIn(mode)}${entry.summary}\n\nTurn the power switch off and unplug the welder before changing cable setup. ${entry.connections.notes ?? ""}${modeFollowUp(mode, "polarity")}`,
      citations: entry.sourcePages.map((page) => ({ document: "Owner Manual", page, label: `${classification.process} polarity setup` })),
      artifact,
    };
  }

  if (classification.intent === "duty-cycle") {
    const rows = [...(cache.dutyCycle["120v"]?.table ?? []), ...(cache.dutyCycle["240v"]?.table ?? [])];
    if (!rows.length) return null;
    const mig240At200 = rows.find((row) => row.voltage === "240v" && row.amperage === 200);
    const row = mig240At200 ?? rows[0];
    return {
      text: `${modeLeadIn(mode)}For MIG welding at ${row.amperage}A on ${row.voltage.toUpperCase()}, the rated duty cycle is ${row.dutyCyclePercent}% in a 10-minute period.${row.restMinutes > 0 ? ` That means weld for ${10 - row.restMinutes} minutes, then let the machine rest for ${row.restMinutes} minutes.` : " At that rating, the manual lists continuous use."}${modeFollowUp(mode, "duty-cycle")}`,
      citations: [{ document: "Owner Manual", page: 7, label: "MIG rated duty cycles" }],
      artifact,
    };
  }

  if (classification.intent === "troubleshooting" && classification.topic === "porosity") {
    const entry = cache.troubleshooting.porosity;
    if (!entry) return null;
    return {
      text: `${modeLeadIn(mode)}For wire-weld porosity, the manual says to check polarity, shielding gas flow/type for MIG, workpiece and wire cleanliness, travel speed, and CTWD. Start with polarity and cleanliness first, then gas/nozzle/CTWD if you are using shielding gas.${modeFollowUp(mode, "troubleshooting")}`,
      citations: entry.sourcePages.map((page) => ({ document: "Owner Manual", page, label: "Wire Weld - Porosity" })),
      artifact,
    };
  }

  return null;
}

function modeInstruction(mode: SupportMode): string {
  const base = "Conversation mode: speak naturally and help the user think through the work in front of them.";
  const modes: Record<SupportMode, string> = {
    using: "Using mode: give concise, in-the-moment operating help. Ask one practical next-step question when useful.",
    setup: "Setup mode: walk through pre-power setup, cable/socket placement, gas/wire preparation, and safety checks before energizing.",
    debugging: "Debugging mode: reason from symptoms. Ask for process, material, voltage, wire/electrode, gas, polarity, and what changed recently.",
    testing: "Testing mode: propose safe verification steps, test welds, observations to compare, and pass/fail criteria.",
    fixing: "Fixing mode: prioritize inspection, cleaning, adjustment, replacement, and maintenance steps. Avoid telling the user to repair energized equipment.",
  };
  return `${base}\n${modes[mode]}`;
}

function modeLeadIn(mode: SupportMode): string {
  const leadIns: Partial<Record<SupportMode, string>> = {
    setup: "For setup, ",
    debugging: "For debugging this, ",
    testing: "For a quick verification test, ",
    fixing: "For fixing this safely, ",
  };
  return leadIns[mode] ?? "";
}

function modeFollowUp(mode: SupportMode, topic: "polarity" | "duty-cycle" | "troubleshooting"): string {
  if (mode === "using") return "";
  if (mode === "setup" && topic === "polarity") return "\n\nBefore you power it on, tell me whether your torch, work clamp, and foot pedal are already plugged in and I can sanity-check the setup.";
  if (mode === "debugging") return "\n\nWhat process, material thickness, input voltage, and consumable are you using right now?";
  if (mode === "testing") return "\n\nMake a short test weld on scrap, then compare the bead to the manual's weld diagnosis examples before changing multiple settings.";
  if (mode === "fixing") return "\n\nPower the welder off and unplug it before inspecting cables, polarity, nozzle/contact tip, or the wire feed path.";
  return "";
}

// ── Follow-up question generation ────────────────────────────────────────────

const INTENT_FOLLOWUPS: Partial<Record<string, string[]>> = {
  "polarity":        ["What happens if I have the polarity reversed?", "Does polarity change for different wire types?", "How do I verify polarity is correct?"],
  "duty-cycle":      ["What happens if I exceed the duty cycle?", "How does input voltage affect duty cycle?", "How long should I wait before resuming?"],
  "troubleshooting": ["What consumables should I inspect first?", "Do I need to clean the nozzle and contact tip?", "Should I run a test weld after the fix?"],
  "setup":           ["What safety checks should I do before power-on?", "What consumables do I need for this process?", "How do I verify the setup is correct?"],
  "settings":        ["How do I fine-tune for thicker material?", "Which shielding gas works best for this wire?", "How do I adjust for out-of-position welding?"],
};

async function generateFollowUpQuestions(answerText: string, intent: string): Promise<string[]> {
  // Fast path: use pre-mapped questions for common intents
  const mapped = INTENT_FOLLOWUPS[intent];
  if (mapped) return mapped;

  // For uncommon intents, generate with the model
  try {
    const raw = await simpleComplete(
      `Return a JSON object {"questions":["q1","q2","q3"]} with 3 specific follow-up questions based on the answer. No prose.`,
      `Answer: "${answerText.slice(0, 800)}"`,
      150
    );
    const parsed = parseJsonObject<{ questions: string[] }>(raw);
    return Array.isArray(parsed?.questions) ? parsed.questions.slice(0, 3) : [];
  } catch {
    return [];
  }
}

// Returns true for short acknowledgment/waiting replies that shouldn't restart guided steps
function isConversationalReply(message: string): boolean {
  const text = message.toLowerCase().trim();
  if (text.split(/\s+/).length > 14) return false;
  return /^(yes|no|ok|okay|yep|nope|sure|got it|done|ready|wait|hold on|one sec|two sec|a second|a minute|give me|doing that|on it|there|did it|all set|finished|complete|checking|working on|trying|almost|hang on|i'm|im |let me|brb|back|thanks|thank|cool|nice|great|perfect|awesome|good|got|yep|roger|copy|10-4|affirmative)/.test(text);
}

const GUIDED_SESSION_SYSTEM = `You are a structured technical writer for the Vulcan OmniPro 220 multi-process welder.
Your job is to produce a step-by-step guided setup session in JSON — no prose, no markdown, just valid JSON.`;

async function generateGuidedSession(userMessage: string, contextText: string): Promise<AgentArtifact | null> {
  const prompt = `Setup question: "${userMessage}"

Manual context:
${contextText || "Use your knowledge of the Vulcan OmniPro 220 welder."}

Produce a guided-session JSON object:
{
  "type": "guided-session",
  "title": "Descriptive title (e.g. 'MIG Welding Setup')",
  "intro": "One sentence: 'I will walk you through [task] on the OmniPro 220.'",
  "steps": [
    {
      "id": "step-1",
      "title": "Short action verb phrase, max 6 words",
      "instruction": "Specific instruction in 1-2 sentences. Name the exact socket, control, or setting.",
      "tip": "One-sentence pro tip or safety note — omit field if not applicable",
      "check": "Confirmation question the user answers before moving on, e.g. 'Have you turned the power switch off?'",
      "manualPage": 14
    }
  ],
  "pages": [
    { "doc": "owner-manual", "page": 14, "caption": "What is shown on this page" }
  ]
}

Rules:
- 4–8 steps. Each instruction under 35 words.
- Always include a power-off/unplug step if the process requires cable changes.
- step.manualPage is optional — omit if unknown.
- pages: 2–4 entries, the most visually useful pages from the manual for this task.
  Valid docs: "owner-manual", "quick-start-guide", "selection-chart".
  Key pages: owner-manual p.4 (controls), p.13 (flux-core polarity), p.14 (MIG polarity), p.24 (TIG), p.37 (troubleshooting). quick-start-guide p.1-2 (setup illustrations). selection-chart p.1 (settings chart).
- Return ONLY the JSON object.`;

  try {
    const raw = await simpleComplete(GUIDED_SESSION_SYSTEM, prompt, 1800);
    const parsed = parseJsonObject<AgentArtifact>(raw);
    if (
      parsed &&
      parsed.type === "guided-session" &&
      Array.isArray((parsed as { steps?: unknown }).steps) &&
      (parsed as { steps: unknown[] }).steps.length > 0
    ) {
      return parsed;
    }
  } catch {
    // Non-critical — fall through to no artifact
  }
  return null;
}

// ── Prompt sanity check ──────────────────────────────────────────────────────

const SCOPE_KEYWORDS = new Set([
  "weld","welder","welding","mig","tig","flux","wire","gas","arc","ampere","amp",
  "volt","voltage","polarity","duty","cycle","electrode","nozzle","spool","drive",
  "roll","roller","regulator","shielding","argon","co2","contact","tip","liner",
  "omnipro","vulcan","bead","spatter","porosity","burnthrough","distortion","slag",
  "stick","dcep","dcen","ctwd","cfh","feed","feeder","torch","gun","clamp","cable",
  "steel","aluminum","stainless","material","gauge","setup","settings","polarity",
  "inert","plasma","metal","heat","thick","thin","inch","mm","machine","power",
  "warping","crater","undercut","overlap","penetration","bevel","tack","fillet",
]);

function isInScope(message: string): boolean {
  const words = message.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
  return words.some((w) => SCOPE_KEYWORDS.has(w) || w.startsWith("weld"));
}

async function checkPromptSanity(message: string): Promise<{ ok: boolean; redirect?: string }> {
  // If obviously in scope, skip model check entirely
  if (isInScope(message)) return { ok: true };
  // Very short messages pass through — model handles them
  if (message.trim().split(/\s+/).length <= 3) return { ok: true };

  try {
    const raw = await simpleComplete(
      'Classify the message as: "welding" (about welding, metalwork, or welding machines), "unclear" (gibberish, incomplete, or meaningless), or "offtopic" (clearly unrelated to welding). Reply with exactly one word.',
      `Message: "${message.slice(0, 300)}"`,
      10
    );
    const label = raw.toLowerCase().trim();
    if (label.startsWith("unclear")) {
      return {
        ok: false,
        redirect: "I didn't quite follow that — could you rephrase? For example: \"How do I set polarity for MIG welding?\" or \"My welds have porosity — what should I check?\"",
      };
    }
    if (label.startsWith("offtopic")) {
      return {
        ok: false,
        redirect: "I can only help with the Vulcan OmniPro 220 welder — setup, settings, troubleshooting, polarity, duty cycle, and similar topics. What welding question can I help with?",
      };
    }
  } catch {
    // If check fails, allow through — don't block valid questions
  }
  return { ok: true };
}
