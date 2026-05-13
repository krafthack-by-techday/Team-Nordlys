import { Elysia, t } from "elysia";
import { ScanRequest } from "@nordlys/contracts";
import { config } from "./config";
import { isAllowedTarget } from "./policy";
import { runScan } from "./runner";
import { createScan, getScan, listScans, updateScan } from "./repos";

async function emitScanEvent(
  scanId: string,
  result: Awaited<ReturnType<typeof runScan>>,
): Promise<void> {
  // Scan results travel the same path as SIEM events: signed by core-svc,
  // fanned out across the Varde-mesh. This keeps scanner-svc stateless re:
  // crypto and lets all downstream consumers treat it as just another
  // event source.
  try {
    await fetch(`${config.coreSvcUrl}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `Scan complete: ${result.targets.join(", ")} (${result.profile})`,
        description: `hosts_up=${result.hosts_up}, open_ports=${result.open_ports}${result.mock ? " [mock]" : ""}\n\n${result.raw_summary}`,
        severity: result.open_ports > 0 ? "medium" : "low",
        source: "scanner",
        external_ref: scanId,
        scenario_id: `scanner.${result.profile}`,
      }),
    });
  } catch (err) {
    console.warn(`[scanner-svc] emit-event failed:`, err);
  }
}

const app = new Elysia({ name: "scanner-svc" })
  .get("/health", () => ({
    status: "ok",
    service: "scanner-svc",
    whitelist: config.whitelist,
    allow_external: config.allowExternal,
    mock_when_missing: config.mockWhenMissing,
  }))
  .get("/scans", () => listScans())
  .get("/scans/:id", async ({ params, set }) => {
    const scan = await getScan(params.id);
    if (!scan) {
      set.status = 404;
      return { error: "not_found" };
    }
    return scan;
  })
  .post(
    "/scans",
    async ({ body, set }) => {
      // Policy: every target must be on the whitelist (unless allow_external).
      const blocked = body.targets.filter((t) => !isAllowedTarget(t));
      if (blocked.length > 0) {
        set.status = 403;
        return {
          error: "target_not_whitelisted",
          blocked,
          whitelist: config.whitelist,
        };
      }

      const scan = await createScan(body);
      // Run synchronously for v1.0 — scans are short and the API client can
      // poll /scans/:id if it wants progress. A worker queue is the next
      // step when scans go beyond /24 deep-scans.
      await updateScan(scan.id, {
        status: "running",
        startedAt: new Date(),
      });
      try {
        const result = runScan({
          targets: body.targets,
          ...(body.ports !== undefined ? { ports: body.ports } : {}),
          profile: body.profile,
        });
        await updateScan(scan.id, {
          status: "completed",
          completedAt: new Date(),
          resultSummary: result.raw_summary,
        });
        void emitScanEvent(scan.id, result);
        set.status = 201;
        return { ...scan, status: "completed", result };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await updateScan(scan.id, {
          status: "failed",
          completedAt: new Date(),
          error: message,
        });
        set.status = 500;
        return { ...scan, status: "failed", error: message };
      }
    },
    { body: ScanRequest },
  )
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "validation_failed", detail: error.message };
    }
    console.error("[scanner-svc] error:", error);
    set.status = (set.status as number) ?? 500;
    return { error: "internal_error" };
  })
  .listen(config.port);

console.log(`[scanner-svc] listening on :${config.port}`);

export type ScannerSvc = typeof app;
