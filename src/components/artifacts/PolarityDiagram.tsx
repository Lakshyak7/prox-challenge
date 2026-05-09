import type { WeldProcess, PolarityConnections } from "@/lib/types";

type Props = { process: WeldProcess; connections: PolarityConnections };

const PROCESS_LABEL: Record<WeldProcess, string> = {
  mig: "MIG (GMAW)",
  "flux-core": "Flux-Core (FCAW)",
  tig: "TIG (GTAW)",
  stick: "Stick (SMAW)",
};

export default function PolarityDiagram({ process, connections }: Props) {
  if (!connections?.electrode || !connections?.work) {
    return (
      <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
        <h3 className="text-sm font-semibold text-zinc-200 mb-2">
          Polarity Setup — {PROCESS_LABEL[process]}
        </h3>
        <p className="text-xs text-zinc-400">
          The assistant returned an incomplete polarity diagram. Ask the question again or check the cited manual section.
        </p>
      </div>
    );
  }

  const torchIsPositive = connections.electrode === "positive";

  return (
    <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
      <h3 className="text-sm font-semibold text-zinc-200 mb-3">
        Polarity Setup — {PROCESS_LABEL[process]}
      </h3>

      <div className="flex gap-4 items-center justify-center my-4">
        {/* Work clamp socket */}
        <div className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 ${
          !torchIsPositive ? "border-red-500 bg-red-900/20" : "border-zinc-600 bg-zinc-700/30"
        }`}>
          <span className="text-lg">{connections.work === "positive" ? "＋" : "−"}</span>
          <span className="text-xs text-zinc-300">Work Clamp</span>
          <span className="text-xs font-mono text-zinc-500">{connections.workSocket}</span>
        </div>

        {/* Machine body placeholder */}
        <div className="text-xs text-zinc-500 text-center">
          <div className="w-20 h-12 bg-zinc-700 rounded flex items-center justify-center text-zinc-400 text-[10px] font-mono">
            OmniPro 220
          </div>
        </div>

        {/* Torch/electrode socket */}
        <div className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 ${
          torchIsPositive ? "border-red-500 bg-red-900/20" : "border-zinc-600 bg-zinc-700/30"
        }`}>
          <span className="text-lg">{connections.electrode === "positive" ? "＋" : "−"}</span>
          <span className="text-xs text-zinc-300">Torch / Electrode</span>
          <span className="text-xs font-mono text-zinc-500">{connections.torchSocket}</span>
        </div>
      </div>

      {connections.notes && (
        <p className="text-xs text-zinc-400 mt-2 border-t border-zinc-700 pt-2">{connections.notes}</p>
      )}
    </div>
  );
}
