/**
 * Health alerts — publishes health events to Redis/SSE when mesh-svc
 * reports degraded Varde scores. Called by mesh-svc via an HTTP endpoint.
 *
 * Rate-limited: max 1 alert per Varde per HEALTH_ALERT_COOLDOWN_MS.
 */

import { Elysia, t } from "elysia";
import { redisPublishHealth } from "../redis-publish";

const ALERT_COOLDOWN_MS = Number(process.env.HEALTH_ALERT_COOLDOWN_MS ?? 600000);

/** Last alert timestamp per vardeId. */
const lastAlertAt = new Map<string, number>();

export const healthAlertRoutes = new Elysia({ prefix: "/health" }).post(
  "/alert",
  async ({ body, set }) => {
    const { varde_id, score, reason } = body;
    const now = Date.now();
    const last = lastAlertAt.get(varde_id) ?? 0;

    if (now - last < ALERT_COOLDOWN_MS) {
      set.status = 429;
      return { ok: false, reason: "rate_limited" };
    }

    lastAlertAt.set(varde_id, now);

    const severity = score < 20 ? "critical" : "high";
    const event = {
      id: `health-${varde_id}-${now}`,
      source: "nordlys-health",
      severity,
      title: `Varde ${varde_id} health degraded (score: ${score.toFixed(0)})`,
      description: reason ?? `Health score dropped to ${score.toFixed(0)}`,
      varde_id,
      score,
      created_at: new Date(now).toISOString(),
    };

    void redisPublishHealth(event);
    set.status = 201;
    return { ok: true, id: event.id };
  },
  {
    body: t.Object({
      varde_id: t.String(),
      score: t.Number(),
      reason: t.Optional(t.String()),
    }),
  },
);
