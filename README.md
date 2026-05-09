# OmniPro 220 AI Support Agent

<img src="product.webp" alt="Vulcan OmniPro 220" width="400" /> <img src="product-inside.webp" alt="Vulcan OmniPro 220 — inside panel" width="400" />

A multimodal, voice-capable AI support assistant for the Vulcan OmniPro 220 welder. Ask anything — polarity setup, duty cycle, troubleshooting, step-by-step guided sessions — and get grounded, accurate answers with interactive diagrams, calculators, and inline manual pages.

**Video walkthrough: [loom.com/share/ff631fb5ce4d46abb72c04607cd8adb9](https://loom.com/share/ff631fb5ce4d46abb72c04607cd8adb9)**

---

## What I Built

### Multimodal artifact responses

Every answer that can be shown visually is shown visually. The agent generates and renders:

| Artifact | Triggered by |
|---|---|
| **Polarity diagram** | Any polarity / cable / socket question |
| **Duty cycle calculator** | Amperage and run-time questions |
| **Troubleshooting flow** | Symptom-based diagnosis (porosity, spatter, arc issues) |
| **Settings configurator** | Process + material + thickness → voltage, wire speed, gas, tips |
| **Manual page viewer** | Any answer that references specific manual pages |
| **Guided session** | Setup and step-by-step walkthroughs |

Artifacts appear in a resizable left panel (drag to resize, collapsible) alongside the chat. Manual pages render as actual PDF canvases — not just links.

### Voice — full duplex

- Persistent mic button keeps Chrome's speech recognition open across silence gaps
- Incremental TTS: the assistant speaks each sentence as it streams, not after the full response arrives
- **Barge-in**: speak while the assistant is talking — speech and generation both cancel, your new input sends immediately
- Voice picker in the header to switch TTS voice mid-conversation

### Weld context panel

Set your current job before you ask — process, material, and metal thickness. This gets injected into every request so the model pre-loads the exact settings and manual sections for your situation before you even ask.

### Manual tab

All three documents (owner manual, quick-start guide, process selection chart) in a full PDF viewer with a resizable chat panel alongside it. Every page reference in a chat message (`p.24`, `page 14`) is a clickable link that jumps directly to that page.

### Manual search as a model tool

The pipeline registers `manual_search` as a callable tool. When the model needs more context, it queries the TF-IDF index directly during generation — no extra API round-trips — and the matched pages surface as a rendered page viewer artifact.

---

## Setup

```bash
git clone <this-repo>
cd <this-repo>
cp .env.example .env   # add your Anthropic API key
pnpm install
pnpm ingest            # extract knowledge from the PDFs in files/
pnpm dev               # http://localhost:3000
```

The only required key is `ANTHROPIC_API_KEY`. Everything else is optional.

```env
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_MODEL_ANSWER=claude-sonnet-4-6
ANTHROPIC_MODEL_FAST=claude-haiku-4-5-20251001
```

`pnpm ingest` runs once and writes `data/knowledge-cache.json` and `data/manual-index.json` from the PDFs in `files/`. The app reads only from those files at runtime — no PDF I/O per request.

---

## Testing the core flows

With the dev server running:

```bash
# TIG polarity — should return a polarity-diagram artifact
curl -sS -N -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"mode":"setup","messages":[{"role":"user","content":"What polarity setup do I need for TIG welding?"}]}'

# Duty cycle — should return a duty-cycle-calculator artifact
curl -sS -N -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"mode":"testing","messages":[{"role":"user","content":"Duty cycle for MIG at 200A on 240V?"}]}'

# Porosity — should return a troubleshooting-flow artifact
curl -sS -N -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"mode":"debugging","messages":[{"role":"user","content":"Getting porosity in my flux-cored welds"}]}'
```

---

## Technical details

Architecture, pipeline design, streaming protocol, knowledge extraction approach, and known limitations are documented in [IMPLEMENTATION_README.md](IMPLEMENTATION_README.md).
