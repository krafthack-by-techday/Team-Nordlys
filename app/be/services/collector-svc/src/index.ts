import { Elysia } from "elysia";
import { config } from "./config";
import { ingestRoutes } from "./routes/ingest";
import { loadScenarios } from "./scenarios";

await loadScenarios(config.scenariosDir);

const app = new Elysia({ name: "collector-svc" })
  .get("/health", () => ({
    status: "ok",
    service: "collector-svc",
    shadow_mode: config.shadowMode,
  }))
  .use(ingestRoutes)
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "validation_failed", detail: error.message };
    }
    console.error("[collector-svc] error:", error);
    set.status = (set.status as number) ?? 500;
    return { error: "internal_error" };
  })
  .listen(config.port);

console.log(`[collector-svc] listening on :${config.port}`);

export type CollectorSvc = typeof app;
