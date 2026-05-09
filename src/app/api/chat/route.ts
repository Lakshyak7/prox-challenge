import { runAgentPipeline } from "@/lib/agent/pipeline";
import type { PipelineRequest, StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: PipelineRequest;
  try {
    body = (await req.json()) as PipelineRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  if (!body.messages?.length) {
    return new Response(JSON.stringify({ error: "messages required" }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runAgentPipeline(body)) {
          const line = `data: ${JSON.stringify(event as StreamEvent)}\n\n`;
          controller.enqueue(encoder.encode(line));
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
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
