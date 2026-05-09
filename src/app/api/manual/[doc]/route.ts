import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const DOC_MAP: Record<string, string> = {
  "owner-manual": "owner-manual.pdf",
  "quick-start-guide": "quick-start-guide.pdf",
  "selection-chart": "selection-chart.pdf",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ doc: string }> }
) {
  const { doc } = await params;
  const fileName = DOC_MAP[doc];

  if (!fileName) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = path.join(process.cwd(), "files", fileName);

  if (!fs.existsSync(filePath)) {
    return new Response("File not found", { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);

  return new Response(fileBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(fileBuffer.byteLength),
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
