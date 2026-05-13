import { Elysia } from "elysia";
import { config } from "./config";
import { getVardeKeypair } from "./keystore";
import { handleClientMsg, unregisterSession } from "./ws-handler";
import { gossipRoutes } from "./routes/gossip";
import { testingRoutes } from "./routes/testing";
import { wellKnownRoutes } from "./routes/wellknown";
import { listSessions } from "./connections";
import { startPeerGossip } from "./peer-gossip";
import { startHealthCheck } from "./health";
import { startRetention } from "./retention";
import { ensureUpcomingPartitions } from "./partitions";
import { tryAcceptUpgrade } from "./throttle";
import { registry } from "./metrics";

// Initialize Varde keypair eagerly so the public key is available in logs.
const { publicKey } = getVardeKeypair();

const app = new Elysia({ name: "varde-svc" })
  .get("/health", () => ({
    status: "ok",
    service: "varde-svc",
    varde_id: config.vardeId,
    public_key: publicKey,
    sessions: listSessions().length,
  }))
  .get(
    "/metrics",
    () =>
      new Response(registry.render(), {
        headers: { "content-type": "text/plain; version=0.0.4; charset=utf-8" },
      }),
  )
  .use(wellKnownRoutes)
  .use(gossipRoutes)
  .use(testingRoutes)
  .ws("/ws", {
    perMessageDeflate: true,
    beforeHandle({ set }) {
      const decision = tryAcceptUpgrade();
      if (!decision.allowed) {
        set.status = 503;
        console.warn(
          `[varde-svc] WS upgrade rejected — accept-rate cap hit (${decision.current}/sec)`,
        );
        return { error: "accept_rate_exceeded" };
      }
    },
    async message(ws, raw) {
      await handleClientMsg(ws.raw as unknown as Parameters<typeof handleClientMsg>[0], raw);
    },
    close(ws) {
      unregisterSession(ws.raw as unknown as Parameters<typeof unregisterSession>[0]);
    },
  })
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "validation_failed", detail: error.message };
    }
    console.error("[varde-svc] error:", error);
    set.status = (set.status as number) ?? 500;
    return { error: "internal_error" };
  })
  .listen(config.port);

console.log(
  `[varde-svc] ${config.vardeId} listening on :${config.port} — public_key=${publicKey.slice(0, 12)}...`,
);

startPeerGossip();
startHealthCheck();
startRetention();

// Partition management: ensure current + next-period partitions exist on
// startup, then re-check once every 24 h so new weekly / monthly partitions
// are created well before they are needed.
void ensureUpcomingPartitions();
setInterval(() => void ensureUpcomingPartitions(), 24 * 60 * 60 * 1000);

export type VardeSvc = typeof app;
