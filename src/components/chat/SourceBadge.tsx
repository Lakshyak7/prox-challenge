import type { AnswerSource } from "@/lib/types";

type Props = { source: AnswerSource; label: string };

const STYLES: Record<AnswerSource, string> = {
  manual: "bg-emerald-900/50 text-emerald-300 border-emerald-700",
  general: "bg-amber-900/50 text-amber-300 border-amber-700",
  web: "bg-blue-900/50 text-blue-300 border-blue-700",
};

export default function SourceBadge({ source, label }: Props) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-mono ${STYLES[source]}`}>
      {label}
    </span>
  );
}
