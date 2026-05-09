#!/usr/bin/env tsx
import "dotenv/config";
import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { ManualIndex, KnowledgeCache } from "../src/lib/types";
import { parseJsonObject } from "../src/lib/json";

const PROVIDER = process.env.ANTHROPIC_API_KEY ? "anthropic" : process.env.GEMINI_API_KEY ? "gemini" : null;
if (!PROVIDER) { console.error("Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env"); process.exit(1); }

const anthropicClient = PROVIDER === "anthropic" ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const geminiClient = PROVIDER === "gemini"
  ? new OpenAI({ apiKey: process.env.GEMINI_API_KEY, baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/" })
  : null;

const ANSWER_MODEL = PROVIDER === "anthropic"
  ? (process.env.ANTHROPIC_MODEL_ANSWER ?? "claude-haiku-4-5-20251001")
  : (process.env.GEMINI_MODEL ?? "gemini-2.0-flash");

const FILES_DIR = path.join(process.cwd(), "files");
const DATA_DIR  = path.join(process.cwd(), "data");
const INDEX_PATH = path.join(DATA_DIR, "manual-index.json");
const CACHE_PATH = path.join(DATA_DIR, "knowledge-cache.json");

const DOCUMENTS = [
  { key: "ownerManual" as const,     filename: "owner-manual.pdf",    title: "Vulcan OmniPro 220 Owner Manual" },
  { key: "quickStartGuide" as const, filename: "quick-start-guide.pdf", title: "Quick Start Guide" },
  { key: "selectionChart" as const,  filename: "selection-chart.pdf",  title: "Welding Selection Chart" },
];

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const index: ManualIndex = fs.existsSync(INDEX_PATH)
    ? JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"))
    : { documents: [], fileIds: {} };

  console.log(`Provider: ${PROVIDER}`);

  if (PROVIDER === "anthropic") {
    await ingestAnthropic(index);
  } else {
    await ingestGemini(index);
  }
}

// ── Anthropic path: upload PDFs via Files API ────────────────────────────────

async function ingestAnthropic(index: ManualIndex) {
  for (const doc of DOCUMENTS) {
    if (index.fileIds[doc.key]) {
      console.log(`  ✓ ${doc.filename} already uploaded (${index.fileIds[doc.key]})`);
      continue;
    }
    const filePath = path.join(FILES_DIR, doc.filename);
    if (!fs.existsSync(filePath)) { console.warn(`  ⚠ ${doc.filename} not found — skip`); continue; }

    console.log(`  ↑ Uploading ${doc.filename}…`);
    const buffer = fs.readFileSync(filePath);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uploaded = await (anthropicClient!.beta as any).files.upload({
      file: new File([buffer], doc.filename, { type: "application/pdf" }),
    });
    index.fileIds[doc.key] = uploaded.id;
    console.log(`    → ${uploaded.id}`);
  }
  index.lastIngested = new Date().toISOString();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));

  let cache = await extractKnowledgeAnthropic(index);
  cache = await precomputeFAQAnthropic(cache, index);
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  console.log("\n✓ Anthropic ingest complete.");
}

async function extractKnowledgeAnthropic(index: ManualIndex): Promise<KnowledgeCache> {
  const existing = loadExistingCache();
  if (!index.fileIds.ownerManual) { console.warn("No owner manual file ID — skip extraction"); return existing; }

  console.log("Extracting structured knowledge (Anthropic)…");
  const response = await anthropicClient!.messages.create({
    model: ANSWER_MODEL,
    max_tokens: 4096,
    messages: [{
      role: "user",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: [
        { type: "document", source: { type: "file", file_id: index.fileIds.ownerManual }, title: "Owner Manual" } as any,
        ...(index.fileIds.selectionChart ? [{ type: "document", source: { type: "file", file_id: index.fileIds.selectionChart }, title: "Selection Chart" } as any] : []),
        { type: "text", text: EXTRACTION_PROMPT },
      ],
    }],
  });
  return parseExtraction(response.content[0].type === "text" ? response.content[0].text : "{}", existing);
}

// ── Gemini path: parse PDFs with pdf-parse, extract with Gemini ──────────────

async function ingestGemini(index: ManualIndex) {
  // Lazy require so pdf-parse doesn't need to be present for Anthropic users
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;

  const texts: Record<string, string> = {};
  for (const doc of DOCUMENTS) {
    const filePath = path.join(FILES_DIR, doc.filename);
    if (!fs.existsSync(filePath)) { console.warn(`  ⚠ ${doc.filename} not found — skip`); continue; }
    console.log(`  📄 Parsing ${doc.filename}…`);
    const { text } = await pdfParse(fs.readFileSync(filePath));
    texts[doc.key] = text;
    console.log(`    → ${text.length.toLocaleString()} chars`);
  }

  index.lastIngested = new Date().toISOString();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));

  console.log("Extracting structured knowledge (Gemini)…");
  const combinedText = [
    texts.ownerManual ? `=== OWNER MANUAL ===\n${texts.ownerManual}` : "",
    texts.selectionChart ? `=== SELECTION CHART ===\n${texts.selectionChart}` : "",
  ].filter(Boolean).join("\n\n");

  let raw = "{}";
  try {
    const res = await geminiClient!.chat.completions.create({
      model: ANSWER_MODEL,
      max_tokens: 8192,
      messages: [
        { role: "user", content: `${combinedText}\n\n---\n\n${EXTRACTION_PROMPT}` },
      ],
      response_format: { type: "json_object" },
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);
    raw = res.choices[0]?.message?.content ?? "{}";
  } catch (err) {
    console.error("  ✗ Gemini extraction call failed; writing deterministic core cache instead.");
    console.error(`    ${String(err).split("\n")[0]}`);
  }

  const cache = parseExtraction(raw, loadExistingCache(), texts);
  // Store raw text for context injection in Gemini chat mode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (cache as any)._rawText = {
    ownerManual: (texts.ownerManual ?? "").slice(0, 80000),
    quickStartGuide: (texts.quickStartGuide ?? "").slice(0, 20000),
    selectionChart: (texts.selectionChart ?? "").slice(0, 20000),
  };
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  console.log("\n✓ Gemini ingest complete.");
}

// ── Shared ───────────────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `From the attached manual, extract the following in JSON.
Return ONLY valid JSON, no explanation.

{
  "polarity": {
    "mig":       { "dcep": boolean, "connections": { "electrode": "positive"|"negative", "work": "positive"|"negative", "torchSocket": string, "workSocket": string, "notes": string }, "sourcePages": number[], "summary": string },
    "flux-core": { "dcep": boolean, "connections": { ... }, "sourcePages": number[], "summary": string },
    "tig":       { "dcep": boolean, "connections": { ... }, "sourcePages": number[], "summary": string },
    "stick":     { "dcep": boolean, "connections": { ... }, "sourcePages": number[], "summary": string }
  },
  "dutyCycle": {
    "120v": { "table": [{ "amperage": number, "voltage": "120v", "dutyCyclePercent": number, "restMinutes": number }], "sourcePages": number[] },
    "240v": { "table": [{ "amperage": number, "voltage": "240v", "dutyCyclePercent": number, "restMinutes": number }], "sourcePages": number[] }
  },
  "troubleshooting": {
    "<issue_slug>": { "checks": [{ "id": string, "description": string, "manualPage": number }], "sourcePages": number[] }
  },
  "settings": {
    "<material_process_key>": { "thicknessMap": { "<thickness_in>": { "wireSpeed": number, "voltage": number, "gas": string } }, "sourcePages": number[] }
  }
}`;

function loadExistingCache(): KnowledgeCache {
  if (!fs.existsSync(CACHE_PATH)) return { polarity: {}, dutyCycle: {}, troubleshooting: {}, settings: {}, adjacent: {}, precomputed: {} };
  return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8")) as KnowledgeCache;
}

// FAQ questions to precompute answers for during ingest
const FAQ_QUESTIONS: Array<{ key: string; q: string }> = [
  { key: "mig_mild_steel_settings", q: "What wire feed speed and voltage should I use for MIG welding 1/8 inch mild steel on 240V with the OmniPro 220?" },
  { key: "tig_setup_walkthrough", q: "Walk me through setting up the OmniPro 220 for TIG welding: polarity, cable connections, gas type, and flow rate." },
  { key: "spatter_reduction", q: "How do I reduce excessive spatter when MIG welding with the OmniPro 220?" },
  { key: "wire_feed_stutter", q: "My wire feed keeps stuttering or stopping on the OmniPro 220. What should I check?" },
  { key: "stick_setup_walkthrough", q: "How do I set up the OmniPro 220 for stick welding, including polarity, cable connections, and electrode selection?" },
];

async function precomputeFAQAnthropic(cache: KnowledgeCache, index: ManualIndex): Promise<KnowledgeCache> {
  if (!index.fileIds.ownerManual) return cache;
  cache.precomputed ??= {};
  const now = new Date().toISOString();

  for (const faq of FAQ_QUESTIONS) {
    if (cache.precomputed[faq.key]) {
      console.log(`  ✓ FAQ already precomputed: ${faq.key}`);
      continue;
    }
    console.log(`  🤔 Precomputing: ${faq.key}…`);
    try {
      const res = await anthropicClient!.messages.create({
        model: ANSWER_MODEL,
        max_tokens: 512,
        system: "You are a support expert for the Vulcan OmniPro 220 multiprocess welder. Answer concisely from the manual. Cite page numbers.",
        messages: [{
          role: "user",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: [
            { type: "document", source: { type: "file", file_id: index.fileIds.ownerManual }, title: "Owner Manual", cache_control: { type: "ephemeral" } } as any,
            { type: "text", text: faq.q },
          ],
        }],
      });
      const answer = res.content[0].type === "text" ? res.content[0].text : "";
      cache.precomputed[faq.key] = { question: faq.q, answer, citations: [], cachedAt: now };
      console.log(`    → OK (${answer.length} chars)`);
    } catch (err) {
      console.error(`    ✗ Failed: ${String(err).split("\n")[0]}`);
    }
  }
  return cache;
}

function parseExtraction(raw: string, fallback: KnowledgeCache, texts?: Record<string, string>): KnowledgeCache {
  const seeded = seedCoreKnowledge(fallback);
  const parsed = parseJsonObject<Partial<KnowledgeCache>>(raw);

  if (!parsed) {
    console.error("  ✗ Failed to parse extraction; using deterministic core extraction fallback.");
    return seedCoreKnowledge(seeded, texts);
  }

  return seedCoreKnowledge({
    polarity: {
      ...seeded.polarity,
      ...parsed.polarity,
    },
    dutyCycle: {
      ...seeded.dutyCycle,
      ...parsed.dutyCycle,
    },
    troubleshooting: {
      ...seeded.troubleshooting,
      ...parsed.troubleshooting,
    },
    settings: {
      ...seeded.settings,
      ...parsed.settings,
    },
    adjacent: fallback.adjacent,
  }, texts);
}

function seedCoreKnowledge(cache: KnowledgeCache, texts?: Record<string, string>): KnowledgeCache {
  const next: KnowledgeCache = {
    polarity: { ...cache.polarity },
    dutyCycle: { ...cache.dutyCycle },
    troubleshooting: { ...cache.troubleshooting },
    settings: { ...cache.settings },
    adjacent: { ...cache.adjacent },
  };

  next.polarity.mig ??= {
    dcep: true,
    connections: {
      electrode: "positive",
      work: "negative",
      torchSocket: "Positive (+) Socket",
      workSocket: "Negative (-) Socket",
      notes: "Solid-core gas-shielded MIG uses DCEP: wire feed power cable positive, ground clamp negative. Owner manual p.14.",
    },
    sourcePages: [14],
    summary: "DCEP solid-core MIG polarity: ground clamp cable in Negative Socket; wire feed power cable in Positive Socket.",
  };

  next.polarity["flux-core"] ??= {
    dcep: false,
    connections: {
      electrode: "negative",
      work: "positive",
      torchSocket: "Negative (-) Socket",
      workSocket: "Positive (+) Socket",
      notes: "Flux-cored gasless welding uses DCEN: wire feed power cable negative, ground clamp positive. Owner manual p.13.",
    },
    sourcePages: [13],
    summary: "DCEN flux-cored polarity: ground clamp cable in Positive Socket; wire feed power cable in Negative Socket.",
  };

  next.polarity.tig ??= {
    dcep: false,
    connections: {
      electrode: "negative",
      work: "positive",
      torchSocket: "Negative (-) Socket",
      workSocket: "Positive (+) Socket",
      notes: "TIG setup: plug Ground Clamp Cable into Positive Socket and TIG Torch Cable into Negative Socket. Owner manual p.24.",
    },
    sourcePages: [24],
    summary: "TIG setup uses torch negative and work clamp positive: ground clamp cable in Positive Socket, TIG torch cable in Negative Socket.",
  };

  next.dutyCycle["120v"] ??= {
    table: [
      { amperage: 100, voltage: "120v", dutyCyclePercent: 40, restMinutes: 6 },
      { amperage: 75, voltage: "120v", dutyCyclePercent: 100, restMinutes: 0 },
    ],
    sourcePages: [7, 23],
  };

  next.dutyCycle["240v"] ??= {
    table: [
      { amperage: 200, voltage: "240v", dutyCyclePercent: 25, restMinutes: 7.5 },
      { amperage: 115, voltage: "240v", dutyCyclePercent: 100, restMinutes: 0 },
    ],
    sourcePages: [7, 23],
  };

  next.troubleshooting.porosity ??= {
    checks: [
      { id: "polarity", description: "Check that polarity is set correctly for the type of welding.", manualPage: 37 },
      { id: "shielding-gas-flow", description: "For MIG, increase shielding gas flow, clean the nozzle, and maintain proper CTWD.", manualPage: 37 },
      { id: "shielding-gas-type", description: "For MIG, use the shielding gas recommended by the wire supplier.", manualPage: 37 },
      { id: "clean-work", description: "Clean the workpiece down to bare metal and make sure wire is clean and free from oil, coatings, and residue.", manualPage: 37 },
      { id: "travel-speed", description: "Maintain a steady travel speed.", manualPage: 37 },
      { id: "ctwd", description: "Reduce CTWD if it is too long.", manualPage: 37 },
    ],
    sourcePages: [37],
  };

  if (texts?.ownerManual && !next.settings.mild_steel_mig) {
    next.settings.mild_steel_mig = { thicknessMap: {}, sourcePages: [] };
  }

  return next;
}

main().catch((err) => { console.error(err); process.exit(1); });
