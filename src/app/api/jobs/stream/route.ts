import { NextRequest } from "next/server";
import { getJobEvents } from "@/lib/jobs/repository";

const POLL_INTERVAL_MS = 500;
const HEARTBEAT_MS = 15000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const afterRaw = searchParams.get("after") || "0";
  const after = Number.parseInt(afterRaw, 10) || 0;

  if (!sessionId) {
    return new Response("Missing sessionId", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let lastEventId = after;
      let lastHeartbeat = Date.now();

      const write = (payload: unknown, id?: number) => {
        if (closed) return;
        const lines: string[] = [];
        if (typeof id === "number") {
          lines.push(`id: ${id}`);
        }
        lines.push(`data: ${JSON.stringify(payload)}`);
        controller.enqueue(encoder.encode(`${lines.join("\n")}\n\n`));
      };

      try {
        while (!closed) {
          const events = await getJobEvents(sessionId, lastEventId);
          for (const event of events) {
            write(
              {
                id: event.id,
                jobId: event.jobId,
                sessionId: event.sessionId,
                messageId: event.messageId,
                type: event.type,
                payload: JSON.parse(event.payload),
                createdAt: event.createdAt,
              },
              event.id,
            );
            lastEventId = event.id;
          }

          const now = Date.now();
          if (now - lastHeartbeat > HEARTBEAT_MS) {
            write({ type: "heartbeat", at: now });
            lastHeartbeat = now;
          }

          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      } catch {
        // disconnect/error ends stream
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // ignore
        }
      }
    },
    cancel() {
      // client closed connection
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
