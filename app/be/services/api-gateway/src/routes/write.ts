import { Elysia } from "elysia";
import {
  ChatMessageInput,
  EventIngestInput,
  ScanRequest,
} from "@nordlys/contracts";
import { authMacro } from "../auth";
import { config } from "../config";

// Frontend write paths. Operator UI posts here; gateway forwards to the
// right backend service after auth + schema validation. Anonymous reads
// are fine, but writes must carry an API key (or, in v1.1, a session
// cookie tied to KraftCERT-issued operator identity).
export const writeRoutes = new Elysia()
  .use(authMacro)
  .post(
    "/events/manual",
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
        tags: ["write"],
        summary: "Operator-authored event from UI",
        description:
          "Used when an operator creates an event manually from the dashboard. Forwarded to collector-svc for normalization and signing, then persisted and gossiped to the mesh. Requires API key.",
      },
    },
  )
  .post(
    "/chat/:eventId",
    async ({ params, body, actor, set }) => {
      const res = await fetch(`${config.services.core}/chat`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gateway-actor": actor.name,
        },
        body: JSON.stringify({ ...body, event_id: params.eventId }),
      });
      set.status = res.status;
      return await res.json().catch(() => ({}));
    },
    {
      requireApiKey: true,
      body: ChatMessageInput,
      detail: {
        tags: ["write"],
        summary: "Post a chat message on an event",
        description:
          "Adds an operator comment to an existing event's chat thread. The thread is shared across the mesh so other companies can see and reply to the discussion. Requires API key.",
      },
    },
  )
  .post(
    "/scans",
    async ({ body, actor, set }) => {
      const res = await fetch(`${config.services.scanner}/scans`, {
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
      body: ScanRequest,
      detail: {
        tags: ["write"],
        summary: "Queue a network scan",
        description:
          "Queues an nmap-based scan against one or more targets. Targets must match the scanner-svc whitelist policy or the request is rejected. Returns the scan id; poll GET /v1/scans/{id} for completion. Requires API key.",
      },
    },
  );
