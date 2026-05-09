import { runAgentPipeline } from "@/lib/agent/pipeline";
import type { StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const formData = await req.formData();
  const image = formData.get("image") as File | null;
  const question = formData.get("question") as string | null;

  if (!image || !question) {
    return new Response(JSON.stringify({ error: "image and question required" }), { status: 400 });
  }

  const arrayBuffer = await image.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runAgentPipeline({
          messages: [{ role: "user", content: question }],
          imageBase64: base64,
          imageMimeType: image.type,
        })) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event as StreamEvent)}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const errEvent: StreamEvent = { type: "error", message: String(err) };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errEvent)}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
