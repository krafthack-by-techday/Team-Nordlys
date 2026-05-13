import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { schema, getDb } from "@nordlys/db";
import { authMacro } from "../auth";
import { config } from "../config";

// Read-only proxies to core-svc. Frontend reads everything via these.
async function proxyGet(url: string): Promise<Response> {
  return fetch(url);
}

export const readRoutes = new Elysia()
  .use(authMacro)
  .get(
    "/events",
    async ({ set }) => {
      const r = await proxyGet(`${config.services.core}/events`);
      set.status = r.status;
      return await r.json().catch(() => []);
    },
    {
      optionalAuth: true,
      detail: {
        tags: ["read"],
        summary: "List events",
        description:
          "All cybersecurity events known to this node, newest first. Includes locally-collected events (SIEM webhooks, manual entry, scanner findings) and events gossiped in via the Varde mesh. Anonymous reads are allowed; pass an API key to attribute access in the audit log.",
      },
    },
  )
  .get(
    "/events/:id",
    async ({ params, set }) => {
      const r = await proxyGet(
        `${config.services.core}/events/${encodeURIComponent(params.id)}`,
      );
      set.status = r.status;
      return await r.json().catch(() => ({}));
    },
    {
      optionalAuth: true,
      detail: {
        tags: ["read"],
        summary: "Get event by id",
        description:
          "Full detail for a single event including the chat thread attached to it. Returns 404 if the event id is unknown to this node.",
      },
    },
  )
  .get(
    "/indicators",
    async ({ set }) => {
      const r = await proxyGet(`${config.services.core}/indicators`);
      set.status = r.status;
      return await r.json().catch(() => []);
    },
    {
      optionalAuth: true,
      detail: {
        tags: ["read"],
        summary: "List indicators (IoCs)",
        description:
          "Indicators of compromise collected on this node and shared via the mesh. Types: ip, domain, hash, url, ttp, email. Each carries a TLP marking and the originating node's signature.",
      },
    },
  )
  .get(
    "/peers",
    async ({ set }) => {
      const r = await proxyGet(`${config.services.core}/peers`);
      set.status = r.status;
      return await r.json().catch(() => []);
    },
    {
      optionalAuth: true,
      detail: {
        tags: ["read"],
        summary: "List mesh peers",
        description:
          "Other Nordlys nodes this node is currently aware of, sourced from the local peer table maintained by mesh-svc. Each entry has node id, company, role and last-seen timestamp.",
      },
    },
  )
  .get(
    "/identities",
    async ({ set }) => {
      const r = await proxyGet(`${config.services.core}/identities`);
      set.status = r.status;
      return await r.json().catch(() => []);
    },
    {
      optionalAuth: true,
      detail: {
        tags: ["read"],
        summary: "List known node identities",
        description:
          "Ed25519 public keys for every node this node has interacted with. Used to verify signed events, indicators and chat messages received via the mesh.",
      },
    },
  )
  .get(
    "/stats",
    async ({ set }) => {
      const r = await proxyGet(`${config.services.core}/stats`);
      set.status = r.status;
      const stats = await r.json().catch(() => ({}));

      // Augment with display name from node_settings
      try {
        const { db } = getDb();
        const row = await db.select({ value: schema.nodeSettings.value })
          .from(schema.nodeSettings)
          .where(eq(schema.nodeSettings.key, "node_name"))
          .limit(1);
        if (row.length > 0) {
          stats.node_display_name = row[0].value;
        }
      } catch { /* ignore */ }

      return stats;
    },
    {
      optionalAuth: true,
      detail: {
        tags: ["read"],
        summary: "Dashboard summary stats",
        description:
          "Aggregate counters for the operator dashboard: event counts by severity, peer count, recent indicator volume, open vulnerabilities. Cheap call — safe to poll.",
      },
    },
  )
  .get(
    "/mesh-activity",
    async ({ set }) => {
      const r = await proxyGet(`${config.services.mesh}/activity`);
      set.status = r.status;
      return await r.json().catch(() => []);
    },
    {
      optionalAuth: true,
      detail: {
        tags: ["read"],
        summary: "Recent mesh activity",
        description:
          "Recent mesh-svc activity log: peer connects/disconnects, relayed messages, reconnect attempts. Powers the live activity feed on the dashboard.",
      },
    },
  )
  .get(
    "/vulnerabilities",
    async ({ set }) => {
      const r = await proxyGet(`${config.services.core}/vulnerabilities`);
      set.status = r.status;
      return await r.json().catch(() => []);
    },
    {
      optionalAuth: true,
      detail: {
        tags: ["read"],
        summary: "List vulnerabilities",
        description:
          "Vulnerabilities tracked on this node with CVE id, CVSS score, severity and status (open / in_progress / mitigated / closed).",
      },
    },
  )
  .get(
    "/tools",
    async ({ set }) => {
      const r = await proxyGet(`${config.services.core}/tools`);
      set.status = r.status;
      return await r.json().catch(() => []);
    },
    {
      optionalAuth: true,
      detail: {
        tags: ["read"],
        summary: "List available tools",
        description:
          "Defensive tools registered on this node, used by the operator toolbox UI.",
      },
    },
  )
  .get(
    "/scans",
    async ({ set }) => {
      const r = await proxyGet(`${config.services.scanner}/scans`);
      set.status = r.status;
      return await r.json().catch(() => []);
    },
    {
      optionalAuth: true,
      detail: {
        tags: ["read"],
        summary: "List scans",
        description:
          "All network scans queued or completed by scanner-svc, newest first. Includes status (queued/running/completed/failed) and timing.",
      },
    },
  )
  .get(
    "/varde-health",
    async ({ set }) => {
      const r = await proxyGet(`${config.services.mesh}/health/vardes`);
      set.status = r.status;
      return await r.json().catch(() => []);
    },
    {
      optionalAuth: true,
      detail: {
        tags: ["read"],
        summary: "Varde tunnel health",
        description:
          "Per-Varde EWMA health scores tracked by mesh-svc: score (0-100), RTT, disconnects, delivery latency, current connection status.",
      },
    },
  )
  .get(
    "/revocations",
    async ({ set }) => {
      const r = await proxyGet(`${config.services.core}/revocations`);
      set.status = r.status;
      return await r.json().catch(() => []);
    },
    {
      optionalAuth: true,
      detail: {
        tags: ["read"],
        summary: "List revocations",
        description:
          "Signed revocations issued by KraftCERT. Each revocation invalidates a previously-signed peer identity by node_id+company.",
      },
    },
  )
  .get(
    "/scans/:id",
    async ({ params, set }) => {
      const r = await proxyGet(
        `${config.services.scanner}/scans/${encodeURIComponent(params.id)}`,
      );
      set.status = r.status;
      return await r.json().catch(() => ({}));
    },
    {
      optionalAuth: true,
      detail: {
        tags: ["read"],
        summary: "Get scan by id",
        description:
          "Single scan with current status and result summary when completed. Poll this after queuing a scan via POST /v1/scans.",
      },
    },
  );
