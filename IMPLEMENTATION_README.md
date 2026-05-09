# OmniPro 220 AI Support Agent — Technical Guide

A multimodal, voice-capable support assistant for the Vulcan OmniPro 220 welder. Grounded in the product manuals, answers with interactive artifacts, and is designed to feel like a live helper while you're standing at the machine.

---

## Quick Start

```bash
pnpm install
cp .env.example .env   # add your Anthropic API key
pnpm ingest            # extract knowledge from the PDFs in files/
pnpm dev               # start the app at http://localhost:3000
```

That's it. The app is fully functional after those four commands.

---

Video Walkthrough: <https://loom.com/share/ff631fb5ce4d46abb72c04607cd8adb9>

## Environment Variables

```env
# Required — primary model provider
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL_ANSWER=claude-sonnet-4-6
ANTHROPIC_MODEL_FAST=claude-haiku-4-5-20251001

# Optional — fallback when Anthropic key is not set
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash

# Optional — enables live web search fallback
BRAVE_SEARCH_API_KEY=
# TAVILY_API_KEY=
```

Provider logic: Anthropic is used when `ANTHROPIC_API_KEY` is set. If it's empty and `GEMINI_API_KEY` is set, the app falls back to Gemini through its OpenAI-compatible endpoint. Web search requires Brave or Tavily; without those keys, the agent stays fully manual-grounded.

---

## Architecture

### Knowledge Pipeline

Ingestion runs once (`pnpm ingest`) and writes two files to `data/`:

- **`knowledge-cache.json`** — structured facts extracted from the PDFs: polarity wiring, duty cycle tables, troubleshooting steps, parts lists, full text chunks per page.
- **`manual-index.json`** — TF-IDF index over page text for fast keyword search.

At runtime the pipeline reads from these files with zero PDF I/O.

### Agent Pipeline (`src/lib/agent/pipeline.ts`)

Each chat request goes through:

1. Normalize input (text, voice transcript, image, mode, weld context, session ID)
2. Context prefetch on the first meaningful user message — pre-loads relevant manual sections before the first answer
3. Off-topic rejection guard
4. Precomputed answers for safety-critical facts (polarity, duty cycle, process-specific wiring)
5. Intent/source/tone classification
6. Manual context retrieval — session vector store + TF-IDF keyword search
7. Model call (streaming SSE) with:
   - Manual search available as a callable tool (`manual_search`)
   - Weld context injected as a system note
   - Artifact generation instructions
8. Artifact extraction from `<artifact>...</artifact>` XML — clean text emitted via `text_replace` event so the raw JSON never shows in the chat bubble
9. Manual page viewer artifact created from any pages returned by `manual_search` tool calls
10. Follow-up question generation
11. Final metadata event

### Streaming Protocol

The API returns Server-Sent Events:

| Event type | Payload |
|---|---|
| `text` | `{ chunk: string }` — incremental text |
| `text_replace` | `{ text: string }` — replace the full assistant message (used after artifact extraction) |
| `metadata` | `{ citations, followUpQuestions, artifact, source }` |
| `[DONE]` | end of stream |

---

## Features

### Chat Tab

**Split layout with resizable panels.** When an artifact or manual pages are present, the screen splits: artifact panel on the left (20–62% of width, collapsible to a 36 px strip), chat on the right. Drag the divider to resize. Split position persists in `localStorage`.

**Weld context panel.** A right-side panel in chat lets you specify your current job — process (MIG / Flux-Core / TIG / Stick), material, thickness, and free-text notes. This context is injected into every request so the model pre-loads the right settings and steps.

**Clickable page references.** Any page reference in an assistant message (`p.24`, `page 14`, etc.) renders as an amber underlined link. Clicking it opens the Manual tab directly to that page in the correct document.

**Inline guided sessions.** Multi-step setup guides render inside the chat thread with progress bars, per-step instructions, manual page links, spoken steps (when voice is on), and back/forward controls.

**All artifact types in the left panel:**

| Type | What it shows |
|---|---|
| `polarity-diagram` | Wiring diagram with labeled sockets and cable colors |
| `duty-cycle-calculator` | Interactive calculator: set amperage, get max on-time and rest time |
| `troubleshooting-flow` | Checklist with expandable steps and resolution status |
| `settings-configurator` | Select process + material + thickness → recommended voltage, wire speed, gas, tips |
| `manual-reference` | Cited page excerpts with jump-to-page links |
| `guided-session` | Step-by-step setup guide (inline in chat) |
| `manual-page-viewer` | Rendered PDF pages returned by manual search tool calls |

### Voice

- Toggle voice input with the mic button in the input bar.
- While listening: pulsing red ring on the button + "Listening…" status line above the input.
- Between recognition cycles: "Voice on — waiting" status so you always know the mic is active.
- Voice replies: the assistant speaks each sentence as it streams (incremental TTS, not wait-for-full-response).
- Barge-in: speak while the assistant is talking or generating — current speech and generation cancel instantly and your new utterance sends.
- Voice picker: choose any browser TTS voice from the header dropdown. Changing it mid-conversation takes effect on the next sentence.

### Manual Tab

Full PDF viewer (all three documents: owner manual, quick-start guide, process selection chart) with a resizable chat panel on the right (35–80% of width, collapsible). Drag the divider or collapse chat to focus on the PDF.

The chat in Manual tab shares the full conversation history with the Chat tab.

### Canvas Tab

Gallery of all artifacts generated during the session. Each card shows the question that triggered it.

---

## Settings Configurator Data

The `settings-configurator` artifact uses hardcoded lookup tables from `src/lib/weld-settings.ts` — real OmniPro 220 synergic settings extracted from the manual. The model's extraction was unreliable for structured tables, so these are coded directly. Covers:

- MIG: mild steel, stainless, aluminum
- Flux-Core: mild steel
- TIG: mild steel, stainless
- Stick: mild steel, stainless

Each entry includes voltage, wire speed (or amperage), gas type, contact tip, and notes.

---

## Manual Search Tool

The pipeline registers `manual_search` as a model-callable tool. When the model decides it needs more manual context, it calls the tool with a query string; the pipeline runs TF-IDF search over the ingested index, returns the top matches as text, and collects the result pages into a `manual-page-viewer` artifact. This means the model can pull in relevant pages on demand without a round-trip to a separate API endpoint.

---

## Known Limitations

- Manual search is keyword/TF-IDF, not embedding-based. Semantic search would improve recall on paraphrased queries.
- Selection chart extraction is weak — `pdf-parse` returns sparse text for that file; the model relies on the cached polarity/process data instead.
- Web search requires Brave or Tavily; there is no Anthropic-native web search path yet.
- Voice input quality depends on the browser. Chrome and Edge are best; Safari support is limited.
- Image input is forwarded to the model with manual context — there is no visual retrieval against specific manual diagrams.

---

## Running Tests

TypeScript:

```bash
pnpm exec tsc --noEmit
```

Smoke tests (with the dev server running):

```bash
# TIG polarity — expects polarity-diagram artifact
curl -sS -N -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"mode":"setup","messages":[{"role":"user","content":"What polarity setup do I need for TIG welding?"}]}'

# Duty cycle — expects duty-cycle-calculator artifact
curl -sS -N -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"mode":"testing","messages":[{"role":"user","content":"Duty cycle for MIG at 200A on 240V?"}]}'

# Porosity — expects troubleshooting-flow artifact
curl -sS -N -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"mode":"debugging","messages":[{"role":"user","content":"Getting porosity in flux-cored welds"}]}'
```
