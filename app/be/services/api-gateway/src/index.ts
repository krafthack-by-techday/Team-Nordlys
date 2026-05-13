import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { auditMacro } from "./audit";
import { config } from "./config";
import { registry, requestsTotal, requestDuration } from "./metrics";
import { ingestRoutes } from "./routes/ingest";
import { readRoutes } from "./routes/read";
import { streamRoutes } from "./routes/stream";
import { writeRoutes } from "./routes/write";
import { authRoutes } from "./routes/auth";
import { setupRoutes } from "./routes/setup";
import { settingsRoutes } from "./routes/settings";
import { accessRequestRoutes, accessRequestApproveRoutes } from "./routes/access-request";
import { inviteRoutes, revokeRoutes } from "./routes/invites";

const app = new Elysia({ name: "api-gateway" })
  // Request timing — stored in store so onAfterResponse can compute duration.
  .onRequest(({ store }) => {
    (store as { _reqStart?: number })._reqStart = Date.now();
  })
  // Record duration + request count after each response (skip /metrics itself
  // to avoid noisy self-instrumentation of the scrape endpoint).
  .onAfterResponse(({ request, set, store }) => {
    const url = new URL(request.url);
    if (url.pathname === "/metrics") return;
    const start = (store as { _reqStart?: number })._reqStart ?? Date.now();
    const durationSec = (Date.now() - start) / 1000;
    const status = String((set.status as number) ?? 200);
    requestsTotal.inc({ method: request.method, path: url.pathname, status });
    requestDuration.observe(durationSec, { method: request.method, path: url.pathname });
  })
  .use(cors({ origin: config.corsOrigin, credentials: true }))
  // Security headers
  .onAfterResponse(({ set }) => {
    const headers = set.headers as Record<string, string>;
    headers["x-content-type-options"] = "nosniff";
    headers["x-frame-options"] = "DENY";
    headers["referrer-policy"] = "strict-origin-when-cross-origin";
    headers["permissions-policy"] = "camera=(), microphone=(), geolocation=()";
  })
  .use(
    swagger({
      path: "/openapi",
      documentation: {
        info: {
          title: "Nordlys API",
          version: "1.0.0",
          description:
            "Single entry point for the Nordlys node stack. " +
            "All external requests (frontend, SIEM, scanner webhooks) go through this gateway. " +
            "All domain endpoints are under /v1; system endpoints (/health, /metrics, /openapi) are under root.",
        },
        tags: [
          { name: "ingest", description: "Inbound events from SIEM and operators" },
          { name: "read", description: "Read-only data for the frontend dashboard" },
          { name: "write", description: "Operator writes (manual events, chat)" },
          { name: "system", description: "Health and meta endpoints" },
        ],
      },
    }),
  )
  .use(auditMacro)
  .get("/health", () => ({ status: "ok", service: "api-gateway" }), {
    detail: {
      tags: ["system"],
      summary: "Health check",
      description:
        "Liveness probe for orchestration. Returns 200 with the service name when the gateway process is up. Does not check downstream service health.",
    },
  })
  .get(
    "/metrics",
    () =>
      new Response(registry.render(), {
        headers: { "content-type": "text/plain; version=0.0.4; charset=utf-8" },
      }),
    {
      detail: {
        tags: ["system"],
        summary: "Prometheus metrics",
        description:
          "Prometheus exposition format: HTTP request counters, request-duration histograms and Node.js runtime stats. Scraped by Prometheus per scrape_interval in prometheus.yml.",
      },
    },
  )
  .group("/v1", (app) =>
    app
      .use(setupRoutes)
      .use(authRoutes)
      .use(settingsRoutes)
      .use(accessRequestRoutes)
      .use(accessRequestApproveRoutes)
      .use(inviteRoutes)
      .use(revokeRoutes)
      .use(ingestRoutes)
      .use(readRoutes)
      .use(writeRoutes)
      .use(streamRoutes)
  )
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "validation_failed", detail: error.message };
    }
    set.status = (set.status as number) ?? 500;
    return { error: "internal_error" };
  })
  .listen(config.port);

console.log(`[api-gateway] listening on :${config.port}`);
console.log(`[api-gateway] OpenAPI: http://localhost:${config.port}/openapi`);

export type ApiGateway = typeof app;
