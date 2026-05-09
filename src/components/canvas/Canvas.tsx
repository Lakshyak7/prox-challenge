import dynamic from "next/dynamic";
import type { ArtifactRecord } from "@/components/AppShell";
import ArtifactRenderer from "@/components/artifacts/ArtifactRenderer";
import SourceBadge from "@/components/chat/SourceBadge";

const ManualPageViewer = dynamic(
  () => import("@/components/artifacts/ManualPageViewer"),
  { ssr: false, loading: () => <div className="h-24 bg-zinc-800 animate-pulse rounded-xl" /> }
);

type Props = {
  artifacts: ArtifactRecord[];
  onAskFollowUp: (q: string) => void;
};

const SUGGESTIONS = [
  { label: "Polarity diagram", prompt: "What polarity setup do I need for TIG welding?" },
  { label: "Duty cycle", prompt: "What's the duty cycle for MIG at 200A on 240V?" },
  { label: "Troubleshooting", prompt: "I'm getting porosity in my welds. What should I check?" },
  { label: "Settings", prompt: "Recommended settings for 1/8 inch mild steel?" },
];

export default function Canvas({ artifacts, onAskFollowUp }: Props) {
  if (!artifacts.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-8 px-6 bg-[#0a0a0d]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/8 border border-amber-500/15 flex items-center justify-center mx-auto mb-5">
            <span className="text-amber-400 text-2xl">⚡</span>
          </div>
          <h2 className="text-zinc-200 font-medium text-sm mb-2">Canvas is empty</h2>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Ask a question that triggers a diagram, calculator, or flow — it will appear here.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 max-w-xs w-full">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              onClick={() => onAskFollowUp(s.prompt)}
              className="text-left bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-white/10 rounded-xl px-3.5 py-3 transition group"
            >
              <div className="text-xs font-medium text-zinc-300 group-hover:text-zinc-100 transition">{s.label}</div>
              <div className="text-[10px] text-zinc-600 mt-0.5 line-clamp-2">{s.prompt}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const current = artifacts[artifacts.length - 1];
  const history = artifacts.slice(0, -1).reverse();

  return (
    <div className="h-full flex flex-col bg-[#0a0a0d] overflow-hidden">
      {/* Current artifact — center stage */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs text-zinc-500 mb-1 truncate max-w-sm">{current.question}</div>
              <SourceBadge source={current.source} label={current.source === "manual" ? "From manual" : current.source === "web" ? "From web" : "General knowledge"} />
            </div>
          </div>

          {/* Artifact */}
          <div className="rounded-2xl overflow-hidden border border-white/5">
            <ArtifactRenderer artifact={current.artifact} onAskFollowUp={onAskFollowUp} />
          </div>

          {/* Manual page images for guided sessions */}
          {current.artifact.type === "guided-session" && current.artifact.pages?.length ? (
            <div className="mt-4 rounded-2xl border border-white/5 overflow-hidden bg-[#111114]">
              <ManualPageViewer pages={current.artifact.pages} />
            </div>
          ) : null}
        </div>
      </div>

      {/* History strip */}
      {history.length > 0 && (
        <div className="shrink-0 border-t border-white/5 px-6 py-3 bg-[#0c0c0f]">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Previous</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {history.map((rec, i) => (
              <button
                key={i}
                onClick={() => onAskFollowUp(rec.question)}
                className="shrink-0 text-left bg-zinc-900 hover:bg-zinc-800 border border-white/5 rounded-xl px-3 py-2 transition max-w-[160px]"
              >
                <div className="text-[10px] text-zinc-500 capitalize">{rec.artifact.type.replace(/-/g, " ")}</div>
                <div className="text-xs text-zinc-300 mt-0.5 truncate">{rec.question}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
