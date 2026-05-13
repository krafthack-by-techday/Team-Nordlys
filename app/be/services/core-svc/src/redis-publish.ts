/**
 * Redis pub/sub publisher for SSE.
 *
 * After core-svc persists a new event/indicator/chat, it publishes the
 * signed object to a Redis channel. The api-gateway subscribes and fans
 * out to SSE clients.
 *
 * Uses Bun's built-in Redis client — reads REDIS_URL from env automatically.
 *
 * Channels:
 *   nordlys:event      — SignedEvent
 *   nordlys:indicator  — SignedIndicator
 *   nordlys:chat       — SignedChatMessage
 *   nordlys:stats      — Stats (after any write that changes aggregates)
 */

import { RedisClient } from "bun";

const REDIS_URL = process.env.REDIS_URL;

let client: RedisClient | null = null;

function getClient(): RedisClient | null {
  if (!REDIS_URL) return null;
  if (!client) {
    client = new RedisClient(REDIS_URL);
    client.onclose = (err) => {
      console.warn("[core-svc] Redis closed:", err?.message);
      client = null;
    };
  }
  return client;
}

async function publish(channel: string, data: unknown): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    await c.publish(channel, JSON.stringify(data));
  } catch (err) {
    console.warn(`[core-svc] Redis publish ${channel} failed:`, err);
    client = null;
  }
}

export const redisPublishEvent = (event: unknown) =>
  publish("nordlys:event", event);

export const redisPublishIndicator = (indicator: unknown) =>
  publish("nordlys:indicator", indicator);

export const redisPublishChat = (chat: unknown) =>
  publish("nordlys:chat", chat);

export const redisPublishStats = (stats: unknown) =>
  publish("nordlys:stats", stats);

export const redisPublishHealth = (alert: unknown) =>
  publish("nordlys:health", alert);
