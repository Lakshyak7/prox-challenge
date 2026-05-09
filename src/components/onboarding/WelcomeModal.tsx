"use client";

type Props = { onTour: () => void; onSkip: () => void };

const FEATURES = [
  { icon: "💬", text: "Ask any question — grounded in the owner's manual" },
  { icon: "🎙", text: "Voice input & spoken replies, hands-free" },
  { icon: "🔧", text: "Step-by-step guided walkthroughs for setup & repair" },
  { icon: "📊", text: "Visual artifacts — polarity diagrams, settings calculators" },
  { icon: "📖", text: "Full manual browser with semantic search" },
];

export default function WelcomeModal({ onTour, onSkip }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-4">
      <div className="bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl max-w-md w-full p-8 flex flex-col gap-7">
        {/* Brand */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <span className="text-amber-400 text-3xl">⚡</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">OmniPro 220 Support Agent</h1>
            <p className="text-sm text-zinc-500 mt-1 leading-relaxed max-w-xs mx-auto">
              An AI assistant built from the Vulcan OmniPro 220 manuals. Ask about setup, troubleshooting, settings, or anything else about your welder.
            </p>
          </div>
        </div>

        {/* Feature list */}
        <ul className="flex flex-col gap-2.5">
          {FEATURES.map((f) => (
            <li key={f.text} className="flex items-center gap-3 text-sm text-zinc-400">
              <span className="text-base shrink-0">{f.icon}</span>
              <span>{f.text}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="flex flex-col gap-2">
          <button
            onClick={onTour}
            className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold text-sm transition"
          >
            Take the tour →
          </button>
          <button
            onClick={onSkip}
            className="w-full py-2 rounded-xl text-zinc-600 hover:text-zinc-400 text-sm transition"
          >
            Skip — I&apos;ll explore on my own
          </button>
        </div>
      </div>
    </div>
  );
}
