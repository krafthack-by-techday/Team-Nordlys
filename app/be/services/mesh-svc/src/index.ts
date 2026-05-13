import { Elysia } from "elysia";
import { config } from "./config";
import { manager } from "./manager";
import { publishRoutes } from "./routes/publish";
import { loadOwnPublicKey } from "./tunnel";
import { healthTracker } from "./health";

// Block startup until core-svc has self-registered and we can read our
// public key. This avoids HELLOs with empty keys after a cold restart.
async function awaitOwnIdentity(): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await loadOwnPublicKey();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("core-svc never produced an identity for this node");
}

await awaitOwnIdentity();
await manager.refresh();

const app = new Elysia({ name: "mesh-svc" })
  .get("/health", () => ({
    status: "ok",
    service: "mesh-svc",
    tunnels: manager.status(),
  }))
  .use(publishRoutes)
  .get("/health/vardes", () => {
    const states = healthTracker.getAllStates();
    const connectedIds = new Set(manager.status().map((t) => t.varde_id));
    const now = Date.now();
    const result: Array<{
      varde_id: string;
      score: number;
      rtt_avg_ms: number | null;
      uptime_pct: number;
      disconnects_24h: number;
      delivery_latency_ms: number | null;
      status: "healthy" | "degraded" | "critical";
      connected: boolean;
    }> = [];
    for (const state of states.values()) {
      const isConnected = connectedIds.has(state.vardeId);
      const uptimeMs = state.connectedAt ? now - state.connectedAt : 0;
      const uptimeHours = uptimeMs / (60 * 60 * 1000);
      const uptimePct = isConnected && uptimeHours > 0
        ? Math.min(100, 100 - (state.disconnectCount / Math.max(1, uptimeHours)) * 5)
        : isConnected
          ? 100
          : 0;
      const status: "healthy" | "degraded" | "critical" =
        state.score >= 70 ? "healthy" : state.score >= 30 ? "degraded" : "critical";
      result.push({
        varde_id: state.vardeId,
        score: state.score,
        rtt_avg_ms: state.lastRttMs,
        uptime_pct: Number(uptimePct.toFixed(1)),
        disconnects_24h: state.disconnectCount,
        delivery_latency_ms: state.lastDeliveryLatencyMs,
        status,
        connected: isConnected,
      });
    }
    return result;
  })
  .post("/refresh-roster", async () => {
    await manager.refresh();
    return { tunnels: manager.status() };
  })
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "validation_failed", detail: error.message };
    }
    console.error("[mesh-svc] error:", error);
    set.status = (set.status as number) ?? 500;
    return { error: "internal_error" };
  })
  .listen(config.port);

console.log(`[mesh-svc] listening on :${config.port}`);
console.log(`[mesh-svc] tunnels: ${JSON.stringify(manager.status())}`);

export type MeshSvc = typeof app;
