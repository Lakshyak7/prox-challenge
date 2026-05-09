export function extractJsonObject(text: string): string | null {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBrace = stripped.indexOf("{");
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = firstBrace; i < stripped.length; i += 1) {
    const ch = stripped[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (ch === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return stripped.slice(firstBrace, i + 1);
    }
  }

  return stripped.slice(firstBrace);
}

export function parseJsonObject<T>(text: string): T | null {
  const candidate = extractJsonObject(text);
  if (!candidate) return null;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}
