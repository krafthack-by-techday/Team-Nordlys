import { Elysia, t } from "elysia";
import { randomUUID } from "node:crypto";
import {
  EventIngestInput,
  IndicatorIngestInput,
  Severity,
} from "@nordlys/contracts";
import { config } from "../config";
import { checkAndReserve } from "../dedup";
import { forwardEvent, forwardIndicator } from "../forward";
import { getScenarios, matchScenario } from "../scenarios";

// SIEM webhook input is structurally permissive: SIEMs differ wildly. We
// require the minimum we need to forward to core-svc, and let scenarios
// extract the rest.
const SiemInput = t.Object({
  title: t.Optional(t.String({ maxLength: 200 })),
  description: t.Optional(t.String()),
  severity: t.Optional(Severity),
  external_ref: t.Optional(t.String({ maxLength: 256 })),
  scenario_id: t.Optional(t.String()),
  // Pass-through fields that scenarios may match against.
  raw: t.Optional(t.Any()),
});

export const ingestRoutes = new Elysia({ prefix: "/ingest" })
  .get("/scenarios", () => getScenarios())
  .post(
    "/siem",
    async ({ body, set }) => {
      // Try matching a scenario against the raw input — that supplies title,
      // severity, scenario_id when the SIEM doesn't.
      const match = matchScenario(body.raw ?? body);

      const externalRef = body.external_ref ?? "";
      const provisionalId = randomUUID();
      const dedup = await checkAndReserve("siem", externalRef, provisionalId);
      if (!dedup.accepted) {
        set.status = 200;
        return {
          status: "duplicate",
          existing_event_id: dedup.existingEventId,
        };
      }

      const isShadow = config.shadowMode || (match?.scenario.shadow ?? false);
      if (isShadow) {
        console.log(
          `[collector-svc] shadow-drop: scenario=${match?.scenario.id ?? "none"}, external_ref=${externalRef}`,
        );
        set.status = 202;
        return { status: "shadowed", scenario_id: match?.scenario.id };
      }

      const event = {
        title: match?.title ?? body.title ?? "Unmatched SIEM event",
        description: match?.description ?? body.description ?? "",
        severity: match?.scenario.severity ?? body.severity ?? "medium",
        source: "siem" as const,
        external_ref: externalRef,
        scenario_id: match?.scenario.id ?? body.scenario_id ?? "",
      };

      const result = await forwardEvent(event);
      if ("error" in result) {
        set.status = result.status;
        return { error: result.error };
      }
      set.status = 201;
      return { id: result.id, scenario_id: event.scenario_id };
    },
    { body: SiemInput },
  )
  .post(
    "/manual",
    async ({ body, set }) => {
      const result = await forwardEvent({ ...body, source: "manual" });
      if ("error" in result) {
        set.status = result.status;
        return { error: result.error };
      }
      set.status = 201;
      return { id: result.id };
    },
    { body: EventIngestInput },
  )
  .post(
    "/indicator",
    async ({ body, set }) => {
      const result = await forwardIndicator(body);
      if ("error" in result) {
        set.status = result.status;
        return { error: result.error };
      }
      set.status = 201;
      return { id: result.id };
    },
    { body: IndicatorIngestInput },
  );
