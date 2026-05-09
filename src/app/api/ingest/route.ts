import { isIngested } from "@/lib/cache/manual-index";

export const runtime = "nodejs";

export async function POST() {
  // Ingest is handled by the CLI script (pnpm ingest).
  // This endpoint exposes ingestion status and can trigger re-ingestion if needed.
  const ingested = isIngested();
  return Response.json({ ingested });
}

export async function GET() {
  const ingested = isIngested();
  return Response.json({ ingested });
}
