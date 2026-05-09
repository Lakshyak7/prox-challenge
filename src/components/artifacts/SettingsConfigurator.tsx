"use client";

import { useState } from "react";
import {
  THICKNESS_OPTIONS,
  getMaterials,
  getAvailableThicknesses,
  lookupSettings,
  isMigSettings,
  isTigSettings,
  isStickSettings,
  type WeldProcess,
  type WeldMaterial,
} from "@/lib/weld-settings";

type Props = {
  defaults?: { process?: WeldProcess; material?: string; thicknessIn?: number };
};

const PROCESSES: Array<{ value: WeldProcess; label: string }> = [
  { value: "mig",       label: "MIG" },
  { value: "flux-core", label: "Flux-Core" },
  { value: "tig",       label: "TIG" },
  { value: "stick",     label: "Stick" },
];

export default function SettingsConfigurator({ defaults = {} }: Props) {
  const [process, setProcess] = useState<WeldProcess>(defaults.process ?? "mig");
  const [material, setMaterial] = useState<WeldMaterial>(() => {
    const mats = getMaterials(defaults.process ?? "mig");
    const defaultMat = defaults.material as WeldMaterial | undefined;
    return (defaultMat && mats.includes(defaultMat)) ? defaultMat : mats[0];
  });
  const [thicknessIn, setThicknessIn] = useState(defaults.thicknessIn ?? 0.125);

  function onProcessChange(p: WeldProcess) {
    setProcess(p);
    const mats = getMaterials(p);
    if (!mats.includes(material)) setMaterial(mats[0]);
  }

  const materials = getMaterials(process);
  const availableThicknesses = getAvailableThicknesses(process, material);
  const settings = lookupSettings(process, material, thicknessIn);

  const selectCls = "w-full bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 px-2.5 py-1.5 outline-none focus:border-amber-500/50 transition";
  const labelCls = "text-[11px] text-zinc-500 uppercase tracking-wide block mb-1";

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/8 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
        <span className="text-amber-400 text-sm">⚙</span>
        <h3 className="text-sm font-semibold text-zinc-200">Settings Configurator</h3>
        <span className="ml-auto text-[10px] text-zinc-600">OmniPro 220</span>
      </div>

      {/* Inputs */}
      <div className="p-4 grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Process</label>
          <select value={process} onChange={(e) => onProcessChange(e.target.value as WeldProcess)} className={selectCls}>
            {PROCESSES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Material</label>
          <select value={material} onChange={(e) => setMaterial(e.target.value as WeldMaterial)} className={selectCls}>
            {materials.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Thickness</label>
          <select
            value={thicknessIn}
            onChange={(e) => setThicknessIn(Number(e.target.value))}
            className={selectCls}
          >
            {THICKNESS_OPTIONS.filter((t) =>
              availableThicknesses.length === 0 || availableThicknesses.some((a) => Math.abs(a - t.inches) < 0.005)
            ).map((t) => (
              <option key={t.inches} value={t.inches}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Output */}
      {settings ? (
        <div className="px-4 pb-4">
          {isMigSettings(settings) && (
            <MigOutput s={settings} process={process} />
          )}
          {isTigSettings(settings) && (
            <TigOutput s={settings} />
          )}
          {isStickSettings(settings) && (
            <StickOutput s={settings} />
          )}
          {settings.manualPage && (
            <p className="text-[11px] text-zinc-600 mt-3 text-right">
              Source: Owner Manual p.{settings.manualPage}
            </p>
          )}
        </div>
      ) : (
        <div className="px-4 pb-4">
          <p className="text-xs text-zinc-500 text-center py-3 bg-zinc-800/50 rounded-lg">
            No data available for this combination.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-zinc-800 rounded-lg p-3 text-center border border-zinc-700/50">
      <div className="text-base font-bold text-amber-300 leading-none">{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
      <div className="text-[11px] text-zinc-500 mt-1">{label}</div>
    </div>
  );
}

function MigOutput({ s, process }: { s: import("@/lib/weld-settings").MigSettings; process: WeldProcess }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Wire Speed" value={`${s.wireSpeed} IPM`} />
        <StatCard label="Voltage" value={`${s.voltage}V`} />
        <StatCard label="Gas Flow" value={s.gasFlow > 0 ? `${s.gasFlow} SCFH` : "None"} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-zinc-800 rounded-lg px-3 py-2.5 border border-zinc-700/50">
          <div className="text-[11px] text-zinc-500 mb-0.5">Shielding Gas</div>
          <div className="text-sm font-medium text-zinc-200">{s.gas}</div>
        </div>
        <div className="bg-zinc-800 rounded-lg px-3 py-2.5 border border-zinc-700/50">
          <div className="text-[11px] text-zinc-500 mb-0.5">Polarity</div>
          <div className="text-sm font-medium text-zinc-200">{s.polarity}</div>
        </div>
      </div>
      {process === "flux-core" && (
        <p className="text-[11px] text-amber-400/80 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">
          Flux-core: work clamp to Positive (+) socket, wire feed power cable to Negative (−) socket. No gas required.
        </p>
      )}
    </div>
  );
}

function TigOutput({ s }: { s: import("@/lib/weld-settings").TigSettings }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Amperage" value={`${s.amperage}A`} sub={`${s.amperageRange[0]}–${s.amperageRange[1]}A range`} />
        <StatCard label="Tungsten" value={s.tungsten} sub="2% thoriated" />
        <StatCard label="Gas Flow" value={`${s.gasFlow} SCFH`} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-zinc-800 rounded-lg px-3 py-2.5 border border-zinc-700/50">
          <div className="text-[11px] text-zinc-500 mb-0.5">Shielding Gas</div>
          <div className="text-sm font-medium text-zinc-200">{s.gas}</div>
        </div>
        <div className="bg-zinc-800 rounded-lg px-3 py-2.5 border border-zinc-700/50">
          <div className="text-[11px] text-zinc-500 mb-0.5">Polarity</div>
          <div className="text-sm font-medium text-zinc-200">{s.polarity}</div>
        </div>
      </div>
      <p className="text-[11px] text-amber-400/80 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">
        TIG: TIG torch to Negative (−) socket, ground clamp to Positive (+) socket. See manual p.24.
      </p>
    </div>
  );
}

function StickOutput({ s }: { s: import("@/lib/weld-settings").StickSettings }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Electrode" value={s.electrode} />
        <StatCard label="Amperage" value={`${s.amperageRange[0]}–${s.amperageRange[1]}A`} />
      </div>
      <div className="bg-zinc-800 rounded-lg px-3 py-2.5 border border-zinc-700/50">
        <div className="text-[11px] text-zinc-500 mb-0.5">Polarity</div>
        <div className="text-sm font-medium text-zinc-200">{s.polarity}</div>
      </div>
    </div>
  );
}
