type Props = { document: string; pages: number[]; reason: string };

export default function ManualReferencePanel({ document, pages, reason }: Props) {
  return (
    <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700 flex gap-3 items-start">
      <div className="text-xl shrink-0">📄</div>
      <div>
        <div className="text-sm font-medium text-zinc-200">{document}</div>
        <div className="text-xs text-zinc-400 mt-0.5">{reason}</div>
        <div className="flex gap-1 mt-2 flex-wrap">
          {pages.map((p) => (
            <span key={p} className="text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded font-mono">
              p.{p}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
