import type { FastifyReply } from "fastify";

export function createSseStream(reply: FastifyReply, origin: string) {
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
  });

  return {
    send(event: string, data: unknown) {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    },
    close() {
      reply.raw.end();
    },
  };
}
