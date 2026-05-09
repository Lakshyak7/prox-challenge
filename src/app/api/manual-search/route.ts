import { NextRequest, NextResponse } from "next/server";
import { searchManual } from "@/lib/search/manual-search";

export type { ManualSearchResult } from "@/lib/search/manual-search";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });
  const results = searchManual(q);
  return NextResponse.json({ results });
}
