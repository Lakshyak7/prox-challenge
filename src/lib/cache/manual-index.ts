import fs from "fs";
import path from "path";
import type { ManualIndex } from "@/lib/types";

const INDEX_PATH = path.join(process.cwd(), "data", "manual-index.json");

export function getManualIndex(): ManualIndex {
  if (!fs.existsSync(INDEX_PATH)) {
    return { documents: [], fileIds: {} };
  }
  return JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8")) as ManualIndex;
}

export function saveManualIndex(index: ManualIndex): void {
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
}

export function getFileIds(): ManualIndex["fileIds"] {
  return getManualIndex().fileIds;
}

export function isIngested(): boolean {
  const index = getManualIndex();
  if (!index.lastIngested) return false;

  // Full ingest with all file IDs
  if (index.fileIds.ownerManual && index.fileIds.quickStartGuide && index.fileIds.selectionChart) {
    return true;
  }

  // Fallback: knowledge-cache.json with usable data (Gemini path or fallback seed)
  const cachePath = path.join(process.cwd(), "data", "knowledge-cache.json");
  if (fs.existsSync(cachePath)) {
    try {
      const cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      if (cache.polarity && Object.keys(cache.polarity).length > 0) return true;
      if (cache.dutyCycle && Object.keys(cache.dutyCycle).length > 0) return true;
    } catch { /* ignore */ }
  }
  return false;
}
