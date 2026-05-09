"use client";

import dynamic from "next/dynamic";
import GuidedSession from "@/components/guided/GuidedSession";
import ArtifactRenderer from "@/components/artifacts/ArtifactRenderer";
import type { AgentArtifact } from "@/lib/types";
import type { Doc } from "@/components/manual/PdfViewer";

const ManualPageViewer = dynamic(
  () => import("@/components/artifacts/ManualPageViewer"),
  { ssr: false, loading: () => <div className="h-40 bg-zinc-800/60 animate-pulse rounded-xl" /> }
);

type Props = {
  artifact: AgentArtifact;
  onAskFollowUp: (q: string) => void;
  voiceReplies?: boolean;
  onOpenManualPage?: (doc: Doc, page: number) => void;
};

const ARTIFACT_META: Record<string, { icon: string; label: string }> = {
  "polarity-diagram":       { icon: "⚡", label: "Polarity Diagram" },
  "duty-cycle-calculator":  { icon: "📊", label: "Duty Cycle Calculator" },
  "troubleshooting-flow":   { icon: "🔍", label: "Troubleshooting Flow" },
  "settings-configurator":  { icon: "⚙",  label: "Settings Configurator" },
  "manual-reference":       { icon: "📖", label: "Manual Reference" },
  "manual-page-viewer":     { icon: "📄", label: "Manual Pages" },
  "code":                   { icon: "✦",  label: "Interactive" },
  "guided-session":         { icon: "📋", label: "Step-by-Step Guide" },
};

export default function InlineArtifact({ artifact, onAskFollowUp, voiceReplies, onOpenManualPage }: Props) {
  const meta = ARTIFACT_META[artifact.type] ?? { icon: "✦", label: artifact.type };

  // guided-session has its own rich UI — render directly without wrapper card
  if (artifact.type === "guided-session") {
    return (
      <GuidedSession
        title={artifact.title}
        intro={artifact.intro}
        steps={artifact.steps}
        onAskFollowUp={onAskFollowUp}
        voiceReplies={voiceReplies}
        onOpenManualPage={onOpenManualPage}
      />
    );
  }

  // manual-page-viewer renders its own section header
  if (artifact.type === "manual-page-viewer") {
    return (
      <div className="mt-3 rounded-2xl overflow-hidden border border-white/8 bg-[#111114]">
        <ManualPageViewer pages={artifact.pages} onOpenManualPage={onOpenManualPage} />
      </div>
    );
  }

  // All other types: unified card wrapper with header
  return (
    <div className="mt-3 rounded-2xl overflow-hidden border border-amber-500/12 bg-[#111114]">
      {/* Card header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-zinc-900/40">
        <span className="text-sm leading-none">{meta.icon}</span>
        <span className="text-[11px] font-semibold text-amber-300/80 uppercase tracking-wider">
          {artifact.type === "code" ? artifact.title : meta.label}
        </span>
      </div>

      {/* Artifact content */}
      <div className="p-4">
        <ArtifactRenderer artifact={artifact} onAskFollowUp={onAskFollowUp} />
      </div>
    </div>
  );
}
