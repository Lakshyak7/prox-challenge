// Vulcan OmniPro 220 synergic settings lookup table.
// Values derived from the OmniPro 220 owner manual and selection chart.
// Organized by process → material → thickness (inches).

export type WeldProcess = "mig" | "flux-core" | "tig" | "stick";
export type WeldMaterial = "Mild Steel" | "Stainless Steel" | "Aluminum";

export type MigSettings = {
  wireSpeed: number;   // IPM
  voltage: number;     // V
  gas: string;
  gasFlow: number;     // SCFH
  polarity: string;
  manualPage?: number;
};

export type TigSettings = {
  amperage: number;    // A recommended
  amperageRange: [number, number];
  tungsten: string;
  gas: string;
  gasFlow: number;     // SCFH
  polarity: string;
  manualPage?: number;
};

export type StickSettings = {
  electrode: string;
  amperageRange: [number, number];
  polarity: string;
  manualPage?: number;
};

export type WeldSettings = MigSettings | TigSettings | StickSettings;

// Thickness label → inches
export const THICKNESS_OPTIONS: Array<{ label: string; inches: number }> = [
  { label: "24 ga (0.024\")", inches: 0.024 },
  { label: "22 ga (0.031\")", inches: 0.031 },
  { label: "20 ga (0.037\")", inches: 0.037 },
  { label: "18 ga (0.048\")", inches: 0.048 },
  { label: "16 ga (0.063\")", inches: 0.063 },
  { label: "14 ga (0.079\")", inches: 0.079 },
  { label: "12 ga (0.105\")", inches: 0.105 },
  { label: "1/8\" (0.125\")", inches: 0.125 },
  { label: "3/16\" (0.188\")", inches: 0.188 },
  { label: "1/4\" (0.250\")", inches: 0.250 },
];

// Map: process → material → thickness (inches, closest match) → settings
// MIG Mild Steel — 0.030" ER70S-6, 75/25 Ar/CO2
const MIG_MILD_STEEL: Record<number, MigSettings> = {
  0.024: { wireSpeed: 165, voltage: 14.0, gas: "75/25 Ar/CO2", gasFlow: 20, polarity: "DCEP (+)", manualPage: 14 },
  0.031: { wireSpeed: 190, voltage: 15.0, gas: "75/25 Ar/CO2", gasFlow: 20, polarity: "DCEP (+)", manualPage: 14 },
  0.037: { wireSpeed: 215, voltage: 15.5, gas: "75/25 Ar/CO2", gasFlow: 20, polarity: "DCEP (+)", manualPage: 14 },
  0.048: { wireSpeed: 245, voltage: 16.5, gas: "75/25 Ar/CO2", gasFlow: 20, polarity: "DCEP (+)", manualPage: 14 },
  0.063: { wireSpeed: 285, voltage: 17.5, gas: "75/25 Ar/CO2", gasFlow: 20, polarity: "DCEP (+)", manualPage: 14 },
  0.079: { wireSpeed: 325, voltage: 18.5, gas: "75/25 Ar/CO2", gasFlow: 20, polarity: "DCEP (+)", manualPage: 14 },
  0.105: { wireSpeed: 370, voltage: 19.5, gas: "75/25 Ar/CO2", gasFlow: 20, polarity: "DCEP (+)", manualPage: 14 },
  0.125: { wireSpeed: 405, voltage: 20.5, gas: "75/25 Ar/CO2", gasFlow: 20, polarity: "DCEP (+)", manualPage: 14 },
  0.188: { wireSpeed: 460, voltage: 22.0, gas: "75/25 Ar/CO2", gasFlow: 25, polarity: "DCEP (+)", manualPage: 14 },
  0.250: { wireSpeed: 500, voltage: 23.5, gas: "75/25 Ar/CO2", gasFlow: 25, polarity: "DCEP (+)", manualPage: 14 },
};

// MIG Stainless Steel — 0.030" ER308L, 98/2 Ar/O2 or tri-mix
const MIG_STAINLESS: Record<number, MigSettings> = {
  0.048: { wireSpeed: 205, voltage: 16.0, gas: "98/2 Ar/O₂", gasFlow: 20, polarity: "DCEP (+)", manualPage: 14 },
  0.063: { wireSpeed: 245, voltage: 17.0, gas: "98/2 Ar/O₂", gasFlow: 20, polarity: "DCEP (+)", manualPage: 14 },
  0.079: { wireSpeed: 285, voltage: 18.0, gas: "98/2 Ar/O₂", gasFlow: 20, polarity: "DCEP (+)", manualPage: 14 },
  0.125: { wireSpeed: 355, voltage: 20.0, gas: "98/2 Ar/O₂", gasFlow: 20, polarity: "DCEP (+)", manualPage: 14 },
  0.188: { wireSpeed: 420, voltage: 22.0, gas: "98/2 Ar/O₂", gasFlow: 25, polarity: "DCEP (+)", manualPage: 14 },
};

// MIG Aluminum — 0.035" ER4043, 100% Argon (requires optional spool gun, p.31)
const MIG_ALUMINUM: Record<number, MigSettings> = {
  0.125: { wireSpeed: 310, voltage: 19.0, gas: "100% Argon", gasFlow: 20, polarity: "DCEP (+)", manualPage: 31 },
  0.188: { wireSpeed: 390, voltage: 21.0, gas: "100% Argon", gasFlow: 25, polarity: "DCEP (+)", manualPage: 31 },
  0.250: { wireSpeed: 460, voltage: 23.0, gas: "100% Argon", gasFlow: 25, polarity: "DCEP (+)", manualPage: 31 },
};

// Flux-Core Mild Steel — 0.030" E71T-GS, no gas, DCEP (work clamp +)
const FC_MILD_STEEL: Record<number, MigSettings> = {
  0.048: { wireSpeed: 195, voltage: 16.0, gas: "None (gasless)", gasFlow: 0, polarity: "DCEP (+)", manualPage: 13 },
  0.063: { wireSpeed: 235, voltage: 17.0, gas: "None (gasless)", gasFlow: 0, polarity: "DCEP (+)", manualPage: 13 },
  0.079: { wireSpeed: 265, voltage: 18.0, gas: "None (gasless)", gasFlow: 0, polarity: "DCEP (+)", manualPage: 13 },
  0.105: { wireSpeed: 295, voltage: 19.0, gas: "None (gasless)", gasFlow: 0, polarity: "DCEP (+)", manualPage: 13 },
  0.125: { wireSpeed: 305, voltage: 19.5, gas: "None (gasless)", gasFlow: 0, polarity: "DCEP (+)", manualPage: 13 },
  0.188: { wireSpeed: 365, voltage: 21.0, gas: "None (gasless)", gasFlow: 0, polarity: "DCEP (+)", manualPage: 13 },
  0.250: { wireSpeed: 415, voltage: 23.0, gas: "None (gasless)", gasFlow: 0, polarity: "DCEP (+)", manualPage: 13 },
};

// TIG Mild Steel — DC-, 100% Argon, DCEN (torch to Negative socket, p.24)
const TIG_MILD_STEEL: Record<number, TigSettings> = {
  0.063: { amperage: 70,  amperageRange: [55, 85],    tungsten: "1/16\"", gas: "100% Argon", gasFlow: 15, polarity: "DCEN (−)", manualPage: 24 },
  0.079: { amperage: 90,  amperageRange: [70, 110],   tungsten: "3/32\"", gas: "100% Argon", gasFlow: 15, polarity: "DCEN (−)", manualPage: 24 },
  0.125: { amperage: 115, amperageRange: [95, 135],   tungsten: "3/32\"", gas: "100% Argon", gasFlow: 15, polarity: "DCEN (−)", manualPage: 24 },
  0.188: { amperage: 160, amperageRange: [140, 180],  tungsten: "3/32\"", gas: "100% Argon", gasFlow: 20, polarity: "DCEN (−)", manualPage: 24 },
  0.250: { amperage: 200, amperageRange: [185, 220],  tungsten: "1/8\"",  gas: "100% Argon", gasFlow: 20, polarity: "DCEN (−)", manualPage: 24 },
};

// TIG Stainless Steel — DC-, 100% Argon
const TIG_STAINLESS: Record<number, TigSettings> = {
  0.063: { amperage: 60,  amperageRange: [45, 75],    tungsten: "1/16\"", gas: "100% Argon", gasFlow: 15, polarity: "DCEN (−)", manualPage: 24 },
  0.125: { amperage: 100, amperageRange: [80, 120],   tungsten: "3/32\"", gas: "100% Argon", gasFlow: 15, polarity: "DCEN (−)", manualPage: 24 },
  0.188: { amperage: 140, amperageRange: [120, 160],  tungsten: "3/32\"", gas: "100% Argon", gasFlow: 20, polarity: "DCEN (−)", manualPage: 24 },
  0.250: { amperage: 175, amperageRange: [155, 200],  tungsten: "1/8\"",  gas: "100% Argon", gasFlow: 20, polarity: "DCEN (−)", manualPage: 24 },
};

// Stick Mild Steel — 6013/7018, AC or DCEP
const STICK_MILD_STEEL: Record<number, StickSettings> = {
  0.048: { electrode: "6013 1/16\"",  amperageRange: [25, 40],   polarity: "AC or DCEP (+)", manualPage: 26 },
  0.063: { electrode: "6013 3/32\"",  amperageRange: [35, 55],   polarity: "AC or DCEP (+)", manualPage: 26 },
  0.079: { electrode: "6013 3/32\"",  amperageRange: [50, 80],   polarity: "AC or DCEP (+)", manualPage: 26 },
  0.125: { electrode: "7018 3/32\"",  amperageRange: [75, 120],  polarity: "AC or DCEP (+)", manualPage: 26 },
  0.188: { electrode: "7018 1/8\"",   amperageRange: [100, 150], polarity: "AC or DCEP (+)", manualPage: 26 },
  0.250: { electrode: "7018 5/32\"",  amperageRange: [140, 190], polarity: "AC or DCEP (+)", manualPage: 26 },
};

// Stick Stainless Steel
const STICK_STAINLESS: Record<number, StickSettings> = {
  0.063: { electrode: "308L-16 3/32\"", amperageRange: [35, 55],  polarity: "DCEP (+)", manualPage: 26 },
  0.125: { electrode: "308L-16 3/32\"", amperageRange: [65, 95],  polarity: "DCEP (+)", manualPage: 26 },
  0.188: { electrode: "308L-16 1/8\"",  amperageRange: [95, 130], polarity: "DCEP (+)", manualPage: 26 },
};

type SettingsTable = Record<number, WeldSettings>;

const SETTINGS_MAP: Record<WeldProcess, Partial<Record<WeldMaterial, SettingsTable>>> = {
  "mig": {
    "Mild Steel":      MIG_MILD_STEEL,
    "Stainless Steel": MIG_STAINLESS,
    "Aluminum":        MIG_ALUMINUM,
  },
  "flux-core": {
    "Mild Steel":      FC_MILD_STEEL,
  },
  "tig": {
    "Mild Steel":      TIG_MILD_STEEL,
    "Stainless Steel": TIG_STAINLESS,
  },
  "stick": {
    "Mild Steel":      STICK_MILD_STEEL,
    "Stainless Steel": STICK_STAINLESS,
  },
};

export function getMaterials(process: WeldProcess): WeldMaterial[] {
  return Object.keys(SETTINGS_MAP[process] ?? {}) as WeldMaterial[];
}

export function getAvailableThicknesses(process: WeldProcess, material: WeldMaterial): number[] {
  const table = SETTINGS_MAP[process]?.[material];
  if (!table) return [];
  return Object.keys(table).map(Number).sort((a, b) => a - b);
}

/** Returns settings for the closest available thickness. */
export function lookupSettings(
  process: WeldProcess,
  material: WeldMaterial,
  thicknessIn: number,
): WeldSettings | null {
  const table = SETTINGS_MAP[process]?.[material];
  if (!table) return null;
  const keys = Object.keys(table).map(Number);
  if (!keys.length) return null;
  const closest = keys.reduce((a, b) =>
    Math.abs(b - thicknessIn) < Math.abs(a - thicknessIn) ? b : a,
  );
  return table[closest] ?? null;
}

export function isMigSettings(s: WeldSettings): s is MigSettings {
  return "wireSpeed" in s;
}
export function isTigSettings(s: WeldSettings): s is TigSettings {
  return "amperage" in s;
}
export function isStickSettings(s: WeldSettings): s is StickSettings {
  return "electrode" in s;
}
