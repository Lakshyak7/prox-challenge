"use client";

import dynamic from "next/dynamic";
import ArtifactRenderer from "@/components/artifacts/ArtifactRenderer";
import type { AgentArtifact, GuidedSessionPage } from "@/lib/types";
import type { Doc } from "@/components/manual/PdfViewer";

const ManualPageViewer = dynamic(
  () => import("@/components/artifacts/ManualPageViewer"),
  { ssr: false, loading: () => <div className="h-48 bg-zinc-800/40 animate-pulse rounded-xl mx-4" /> }
);

const ARTIFACT_META: Record<string, { icon: string; label: string }> = {
  "polarity-diagram":       { icon: "⚡", label: "Polarity Diagram" },
  "duty-cycle-calculator":  { icon: "📊", label: "Duty Cycle Calculator" },
  "troubleshooting-flow":   { icon: "🔍", label: "Troubleshooting Flow" },
  "settings-configurator":  { icon: "⚙",  label: "Settings Configurator" },
  "manual-reference":       { icon: "📖", label: "Manual Reference" },
  "code":                   { icon: "✦",  label: "Interactive" },
};

type Props = {
  artifact: AgentArtifact | null;
  pages: GuidedSessionPage[];
  onAskFollowUp: (q: string) => void;
  onOpenManualPage?: (doc: Doc, page: number) => void;
};

export default function ArtifactPanel({ artifact, pages, onAskFollowUp, onOpenManualPage }: Props) {
  const hasArtifact = artifact !== null;
  const hasPages = pages.length > 0;

  if (!hasArtifact && !hasPages) return null;

  const meta = artifact ? (ARTIFACT_META[artifact.type] ?? { icon: "✦", label: artifact.type }) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden border-r border-white/5 bg-[#0a0a0d]">
      {/* Artifact section */}
      {hasArtifact && artifact && (
        <div className="shrink-0 border-b border-white/5">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-zinc-900/40">
            <span className="text-sm leading-none">{meta?.icon}</span>
            <span className="text-[11px] font-semibold text-amber-300/80 uppercase tracking-wider">
              {artifact.type === "code" ? artifact.title : meta?.label}
            </span>
          </div>
          <div className="p-4 max-h-[50vh] overflow-y-auto">
            <ArtifactRenderer artifact={artifact} onAskFollowUp={onAskFollowUp} />
          </div>
        </div>
      )}

      {/* Manual pages section — scrollable */}
      {hasPages && (
        <div className="flex-1 overflow-y-auto">
          <ManualPageViewer pages={pages} onOpenManualPage={onOpenManualPage} />
        </div>
      )}

      {/* Empty state */}
      {!hasArtifact && !hasPages && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/8 border border-amber-500/12 flex items-center justify-center">
            <span className="text-amber-400/60 text-xl">⚡</span>
          </div>
          <p className="text-xs text-zinc-600 leading-relaxed max-w-[180px]">
            Diagrams, calculators, and manual pages will appear here
          </p>
        </div>
      )}
    </div>
  );
}
