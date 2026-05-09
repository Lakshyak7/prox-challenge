type Props = {
  code: string;
  title: string;
  language: "html" | "svg";
};

export default function CodeArtifact({ code, title, language }: Props) {
  const srcdoc =
    language === "svg"
      ? `<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#1a1a1a">${code}</body></html>`
      : code;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500 font-mono px-1">{title}</span>
      <iframe
        title={title}
        srcDoc={srcdoc}
        sandbox="allow-scripts"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900"
        style={{ height: 360 }}
      />
    </div>
  );
}
