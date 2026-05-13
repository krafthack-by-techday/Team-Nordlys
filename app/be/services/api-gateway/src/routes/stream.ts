/**
 * SSE streaming endpoint — `GET /v1/stream`
 *
 * Subscribes to Redis pub/sub channels and fans out messages to all
 * connected SSE clients. The frontend connects via EventSource through
 * the SvelteKit BFF proxy.
 *
 * Uses Bun's built-in Redis client for pub/sub.
 *
 * SSE event types:
 *   event      — SignedEvent
 *   indicator  — SignedIndicator
 *   chat       — SignedChatMessage
 *   stats      — Stats
 *   peer       — PeerWithStatus
 */

import { Elysia } from "elysia";
import { RedisClient } from "bun";
import { authMacro } from "../auth";
import { config } from "../config";

// ── Channel → SSE event name mapping ────────────────────────────────
const CHANNELS = [
  "nordlys:event",
  "nordlys:indicator",
  "nordlys:chat",
  "nordlys:stats",
  "nordlys:peer",
  "nordlys:health",
] as const;

function channelToEventName(channel: string): string {
  return channel.replace("nordlys:", "");
}

// ── Client registry ─────────────────────────────────────────────────
type SSEClient = {
  controller: ReadableStreamDefaultController<Uint8Array>;
  closed: boolean;
};

const clients = new Set<SSEClient>();

// ── Redis subscriber (singleton) ────────────────────────────────────
let subscriber: RedisClient | null = null;
let subscriberReady = false;

async function ensureSubscriber(): Promise<void> {
  if (subscriberReady || !config.redisUrl) return;
  if (subscriber) return; // connection in progress

  try {
    subscriber = new RedisClient(config.redisUrl);
    await subscriber.connect();

    subscriber.onclose = (err) => {
      console.warn("[api-gateway] Redis subscriber closed:", err?.message);
      subscriber = null;
      subscriberReady = false;
    };

    // Bun's subscribe takes a callback per channel
    for (const channel of CHANNELS) {
      await subscriber.subscribe(channel, (message: string, ch: string) => {
        broadcast(channelToEventName(ch), message);
      });
    }

    subscriberReady = true;
    console.log(
      `[api-gateway] SSE subscribed to ${CHANNELS.length} Redis channels`,
    );
  } catch (err) {
    console.error("[api-gateway] Redis subscribe failed:", err);
    subscriber = null;
    subscriberReady = false;
  }
}

function broadcast(eventName: string, data: string): void {
  const frame = `event: ${eventName}\ndata: ${data}\n\n`;
  const encoded = new TextEncoder().encode(frame);

  for (const client of clients) {
    if (client.closed) {
      clients.delete(client);
      continue;
    }
    try {
      client.controller.enqueue(encoded);
    } catch {
      client.closed = true;
      clients.delete(client);
    }
  }
}

// ── Heartbeat — keep connections alive through proxies ───────────────
setInterval(() => {
  const comment = new TextEncoder().encode(": heartbeat\n\n");
  for (const client of clients) {
    if (client.closed) {
      clients.delete(client);
      continue;
    }
    try {
      client.controller.enqueue(comment);
    } catch {
      client.closed = true;
      clients.delete(client);
    }
  }
}, 15_000);

// ── Elysia route ────────────────────────────────────────────────────
export const streamRoutes = new Elysia()
  .use(authMacro)
  .get(
    "/stream",
    async () => {
      await ensureSubscriber();

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const client: SSEClient = { controller, closed: false };
          clients.add(client);

          // Send initial connected event
          const hello = `event: connected\ndata: ${JSON.stringify({ clients: clients.size })}\n\n`;
          controller.enqueue(new TextEncoder().encode(hello));
        },
        cancel() {
          // Client disconnected — cleanup happens on next broadcast
        },
      });

      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache, no-store, must-revalidate",
          connection: "keep-alive",
          "x-accel-buffering": "no", // disable nginx buffering
        },
      });
    },
    {
      optionalAuth: true,
      detail: {
        tags: ["read"],
        summary: "Live SSE stream",
        description:
          "Server-Sent Events stream for real-time updates. Emits typed events " +
          "(event, indicator, chat, stats, peer) as they arrive via Redis pub/sub. " +
          "The frontend connects through the BFF proxy at /api/v1/stream.",
      },
    },
  );
