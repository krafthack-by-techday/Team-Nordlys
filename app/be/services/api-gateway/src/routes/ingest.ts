import { Elysia } from "elysia";
import {
  EventIngestInput,
  IndicatorIngestInput,
} from "@nordlys/contracts";
import { authMacro } from "../auth";
import { config } from "../config";

// Forwards SIEM/manual ingest to collector-svc after auth + schema-validation.
// Backend services trust requests reaching them — auth lives only here.
export const ingestRoutes = new Elysia({ prefix: "/ingest" })
  .use(authMacro)
  .post(
    "/siem",
    async ({ body, actor, set }) => {
      const res = await fetch(`${config.services.collector}/ingest/siem`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gateway-actor": actor.name,
        },
        body: JSON.stringify(body),
      });
      set.status = res.status;
      return await res.json().catch(() => ({}));
    },
    {
      requireApiKey: true,
      body: EventIngestInput,
      detail: {
        tags: ["ingest"],
        summary: "SIEM webhook",
        description:
          "Webhook endpoint for SIEM platforms (Splunk, Elastic, Sentinel, etc). Incoming events are matched against scenario YAML in collector-svc, normalized to the Event schema, signed by this node, persisted, and gossiped onto the mesh. Requires API key.",
      },
    },
  )
  .post(
    "/manual",
    async ({ body, actor, set }) => {
      const res = await fetch(`${config.services.collector}/ingest/manual`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gateway-actor": actor.name,
        },
        body: JSON.stringify(body),
      });
      set.status = res.status;
      return await res.json().catch(() => ({}));
    },
    {
      requireApiKey: true,
      body: EventIngestInput,
      detail: {
        tags: ["ingest"],
        summary: "Manual event from operator UI",
        description:
          "Manual event submission, primarily for backend integrations and scripts. The operator UI uses POST /v1/events/manual instead, which routes through the same collector-svc path. Requires API key.",
      },
    },
  )
  .post(
    "/indicator",
    async ({ body, actor, set }) => {
      const res = await fetch(`${config.services.collector}/ingest/indicator`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gateway-actor": actor.name,
        },
        body: JSON.stringify(body),
      });
      set.status = res.status;
      return await res.json().catch(() => ({}));
    },
    {
      requireApiKey: true,
      body: IndicatorIngestInput,
      detail: {
        tags: ["ingest"],
        summary: "Manual indicator (IoC)",
        description:
          "Submit an indicator of compromise (IP, domain, hash, URL, TTP, email). Validated, signed, persisted, and gossiped to the mesh. Typically called by integration scripts; the operator UI drives this through richer flows. Requires API key.",
      },
    },
  );
