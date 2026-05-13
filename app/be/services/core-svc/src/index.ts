import { Elysia } from "elysia";
import { config } from "./config";
import { selfRegister, selfActivate } from "./bootstrap";
import { eventRoutes } from "./routes/events";
import { indicatorRoutes } from "./routes/indicators";
import { chatRoutes } from "./routes/chat";
import { identityRoutes } from "./routes/identity";
import { verifyRoutes } from "./routes/verify";
import { statsRoutes } from "./routes/stats";
import { inboundRoutes, cursorRoutes } from "./routes/inbound";
import { healthAlertRoutes } from "./routes/health-alerts";
import { accessRequestRoutes } from "./routes/access-request";

await selfRegister();

const app = new Elysia({ name: "core-svc" })
  .post("/self-activate", async () => {
    const result = await selfActivate();
    return { ok: true, ...result };
  })
  .use(statsRoutes)
  .use(eventRoutes)
  .use(indicatorRoutes)
  .use(chatRoutes)
  .use(identityRoutes)
  .use(verifyRoutes)
  .use(inboundRoutes)
  .use(cursorRoutes)
  .use(healthAlertRoutes)
  .use(accessRequestRoutes)
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "validation_failed", detail: error.message };
    }
    console.error("[core-svc] error:", error);
    set.status = (set.status as number) ?? 500;
    return { error: "internal_error" };
  })
  .listen(config.port);

console.log(`[core-svc] listening on :${config.port}`);

export type CoreSvc = typeof app;
