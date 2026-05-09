"use client";

import { useState } from "react";
import type { DutyCycleEntry, DutyCycleDefaults, WeldProcess } from "@/lib/types";

type Props = { defaults: DutyCycleDefaults; table: DutyCycleEntry[] };

const PROCESSES: WeldProcess[] = ["mig", "flux-core", "tig", "stick"];

export default function DutyCycleCalculator({ defaults, table }: Props) {
  const [voltage, setVoltage] = useState<"120v" | "240v">(defaults.voltage ?? "240v");
  const [amperage, setAmperage] = useState(defaults.amperage ?? 130);

  const voltageRows = table.filter((r) => r.voltage === voltage);
  const sorted = [...voltageRows].sort((a, b) => a.amperage - b.amperage);

  // Find nearest entry to selected amperage
  const nearest = sorted.reduce<DutyCycleEntry | null>((prev, curr) => {
    if (!prev) return curr;
    return Math.abs(curr.amperage - amperage) < Math.abs(prev.amperage - amperage) ? curr : prev;
  }, null);

  const amps = sorted.map((r) => r.amperage);
  const min = Math.min(...amps, 30);
  const max = Math.max(...amps, 220);

  return (
    <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
      <h3 className="text-sm font-semibold text-zinc-200 mb-3">Duty Cycle Calculator</h3>

      <div className="flex gap-4 mb-4">
        <div>
          <label className="text-xs text-zinc-400 block mb-1">Input Voltage</label>
          <div className="flex gap-1">
            {(["120v", "240v"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVoltage(v)}
                className={`px-3 py-1 text-xs rounded border transition ${
                  voltage === v
                    ? "bg-garage-700 border-garage-500 text-garage-100"
                    : "bg-zinc-700 border-zinc-600 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                {v.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          <label className="text-xs text-zinc-400 block mb-1">Amperage: {amperage}A</label>
          <input
            type="range"
            min={min}
            max={max}
            step={5}
            value={amperage}
            onChange={(e) => setAmperage(Number(e.target.value))}
            className="w-full accent-garage-500"
          />
        </div>
      </div>

      {nearest && (
        <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-700 flex gap-4 items-center">
          <div className="text-center">
            <div className="text-2xl font-bold text-garage-300">{nearest.dutyCyclePercent}%</div>
            <div className="text-xs text-zinc-500">Duty Cycle</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold text-zinc-200">{nearest.amperage}A</div>
            <div className="text-xs text-zinc-500">at {voltage.toUpperCase()}</div>
          </div>
          {nearest.restMinutes > 0 && (
            <div className="text-center">
              <div className="text-xl font-semibold text-amber-300">{nearest.restMinutes} min</div>
              <div className="text-xs text-zinc-500">Cool-down</div>
            </div>
          )}
        </div>
      )}

      {/* Full table */}
      <table className="w-full text-xs mt-3">
        <thead>
          <tr className="text-zinc-500 border-b border-zinc-700">
            <th className="text-left py-1">Amperage</th>
            <th className="text-left py-1">Duty Cycle</th>
            <th className="text-left py-1">Cool-down</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.amperage}
              className={`border-b border-zinc-800 ${nearest?.amperage === row.amperage ? "text-garage-300" : "text-zinc-400"}`}
            >
              <td className="py-1">{row.amperage}A</td>
              <td className="py-1">{row.dutyCyclePercent}%</td>
              <td className="py-1">{row.restMinutes > 0 ? `${row.restMinutes} min` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-xs text-zinc-600 mt-2">
        Source: Owner Manual. {PROCESSES.join(", ")} duty cycles may vary — check manual section for your process.
      </p>
    </div>
  );
}
