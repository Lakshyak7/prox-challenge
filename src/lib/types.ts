// ─── Core response types ────────────────────────────────────────────────────

export type AnswerSource = "manual" | "general" | "web";
export type Confidence = "high" | "medium" | "low";
export type WeldProcess = "mig" | "flux-core" | "tig" | "stick";
export type SupportMode = "using" | "setup" | "debugging" | "testing" | "fixing";

export type Citation = {
  document: string;
  page?: number;
  label: string;
  url?: string;
};

export type AgentArtifact =
  | { type: "code"; language: "html" | "svg"; code: string; title: string }
  | { type: "polarity-diagram"; process: WeldProcess; connections: PolarityConnections }
  | { type: "duty-cycle-calculator"; defaults: DutyCycleDefaults; table: DutyCycleEntry[] }
  | { type: "troubleshooting-flow"; issue?: string; title?: string; steps: TroubleshootingStep[] }
  | { type: "settings-configurator"; defaults: SettingsDefaults }
  | { type: "manual-reference"; document: string; pages: number[]; reason: string }
  | { type: "manual-page-viewer"; pages: GuidedSessionPage[] }
  | { type: "guided-session"; title: string; intro: string; steps: GuidedStep[]; pages?: GuidedSessionPage[] };

export type AgentResponse = {
  text: string;
  source: AnswerSource;
  sourceLabel: string;
  citations: Citation[];
  transcript?: { heard?: string; spoken?: string };
  confidence: Confidence;
  followUpQuestions: string[];
  artifact?: AgentArtifact;
};

// ─── Pipeline ───────────────────────────────────────────────────────────────

export type PipelineMessage = {
  role: "user" | "assistant";
  content: string;
};

export type WeldContext = {
  process: string;
  material: string;
  thicknessIn: number;
  notes?: string;
};

export type PipelineRequest = {
  messages: PipelineMessage[];
  mode?: SupportMode;
  voiceTranscript?: string;
  imageBase64?: string;
  imageMimeType?: string;
  sessionId?: string;
  weldContext?: WeldContext;
};

export type StreamEvent =
  | { type: "text"; chunk: string }
  | { type: "text_replace"; text: string }
  | { type: "metadata"; data: Omit<AgentResponse, "text"> }
  | { type: "error"; message: string };

// ─── Classification ──────────────────────────────────────────────────────────

export type IntentType =
  | "setup"
  | "troubleshooting"
  | "polarity"
  | "duty-cycle"
  | "settings"
  | "part-identification"
  | "safety"
  | "general-explanation"
  | "out-of-manual";

export type ToneType = "confused" | "frustrated" | "urgent" | "curious" | "confident";

export type Classification = {
  intent: IntentType;
  source: AnswerSource;
  tone: ToneType;
  topic: string;
  process?: WeldProcess;
};

// ─── Validation ──────────────────────────────────────────────────────────────

export type ConflictItem = {
  candidateClaim: string;
  manualSpec: string;
  manualPage?: number;
};

export type CorroborationItem = {
  claim: string;
  manualPage: number;
  document: string;
};

export type SafetyGap = {
  description: string;
  manualNote: string;
  manualPage?: number;
  severity: "critical" | "warning" | "info";
};

export type ValidationResult = {
  conflicts: ConflictItem[];
  corroborations: CorroborationItem[];
  safetyGaps: SafetyGap[];
};

// ─── Guided session ──────────────────────────────────────────────────────────

export type GuidedStep = {
  id: string;
  title: string;
  instruction: string;
  tip?: string;
  check: string;
  manualPage?: number;
};

export type GuidedSessionPage = {
  doc: "owner-manual" | "quick-start-guide" | "selection-chart";
  page: number;
  caption?: string;
};

// ─── Artifacts ───────────────────────────────────────────────────────────────

export type PolarityConnections = {
  electrode: "positive" | "negative";
  work: "positive" | "negative";
  torchSocket: string;
  workSocket: string;
  notes?: string;
};

export type DutyCycleDefaults = {
  process: WeldProcess;
  voltage: "120v" | "240v";
  amperage: number;
};

export type DutyCycleEntry = {
  amperage: number;
  voltage: "120v" | "240v";
  dutyCyclePercent: number;
  restMinutes: number;
};

export type TroubleshootingStep = {
  id: string | number;
  // checklist format
  description?: string;
  manualPage?: number;
  completed?: boolean;
  // decision-tree format
  check?: string;
  yes?: string | number;
  no?: string;
};

export type SettingsDefaults = {
  process?: WeldProcess;
  material?: string;
  thicknessIn?: number;
};

// ─── Knowledge Cache ─────────────────────────────────────────────────────────

export type ManualIndexDocument = {
  document: string;
  fileId?: string;
  totalPages: number;
  purpose: string;
  sections: Array<{ title: string; pages: number[]; topic: string }>;
};

export type ManualIndex = {
  documents: ManualIndexDocument[];
  fileIds: {
    ownerManual?: string;
    quickStartGuide?: string;
    selectionChart?: string;
    productImage?: string;
    productInsideImage?: string;
  };
  lastIngested?: string;
};

export type AdjacentCacheEntry = {
  source: "web" | "general";
  url?: string;
  summary: string;
  cachedAt: string;
  validated: boolean;
};

export type PrecomputedAnswer = {
  question: string;
  answer: string;
  citations: Citation[];
  cachedAt: string;
};

export type KnowledgeCache = {
  polarity: Partial<Record<WeldProcess, {
    dcep: boolean;
    connections: PolarityConnections;
    sourcePages: number[];
    summary: string;
  }>>;
  dutyCycle: Partial<Record<"120v" | "240v", {
    table: DutyCycleEntry[];
    sourcePages: number[];
  }>>;
  troubleshooting: Record<string, { checks: TroubleshootingStep[]; sourcePages: number[] }>;
  settings: Record<string, { thicknessMap: unknown; sourcePages: number[] }>;
  adjacent: Record<string, AdjacentCacheEntry>;
  precomputed?: Record<string, PrecomputedAnswer>;
};

// ─── Search ──────────────────────────────────────────────────────────────────

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};
