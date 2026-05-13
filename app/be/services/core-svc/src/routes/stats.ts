import { Elysia } from "elysia";
import { count, eq, and, gte, sql } from "drizzle-orm";
import { schema } from "@nordlys/db";
import { getDbInstance } from "../db";
import { config } from "../config";

/** Read live node identity from DB (survives setup wizard without restart). */
async function getNodeIdentity(): Promise<{ nodeId: string; company: string; role: string }> {
  const db = getDbInstance();
  const rows = await db
    .select({ key: schema.nodeSettings.key, value: schema.nodeSettings.value })
    .from(schema.nodeSettings);
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const nodeId = settings.node_id ?? config.nodeId;
  const company = settings.company ?? config.company;
  const role = nodeId.includes("kraftcert") ? "kraftcert" : "peer";
  return { nodeId, company, role };
}

export const statsRoutes = new Elysia()
  .get("/health", () => ({ status: "ok", service: "core-svc" }))
  .get("/stats", async () => {
    const db = getDbInstance();
    const identity = await getNodeIdentity();

    // ── Peers ──
    const [peersTotal] = await db.select({ n: count() }).from(schema.peers);

    // ── Events ──
    const [eventsTotal] = await db.select({ n: count() }).from(schema.events);

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [eventsLast24h] = await db
      .select({ n: count() })
      .from(schema.events)
      .where(gte(schema.events.createdAt, twentyFourHoursAgo));

    const [eventsCritical24h] = await db
      .select({ n: count() })
      .from(schema.events)
      .where(
        and(
          gte(schema.events.createdAt, twentyFourHoursAgo),
          sql`${schema.events.severity} IN ('critical', 'high')`
        )
      );

    // ── Indicators ──
    const [indicatorsTotal] = await db
      .select({ n: count() })
      .from(schema.indicators);
    const [indicatorsTlpRed] = await db
      .select({ n: count() })
      .from(schema.indicators)
      .where(eq(schema.indicators.tlp, "red"));
    const [indicatorsTlpAmber] = await db
      .select({ n: count() })
      .from(schema.indicators)
      .where(eq(schema.indicators.tlp, "amber"));

    // ── Vulnerabilities ──
    const [vulnOpen] = await db
      .select({ n: count() })
      .from(schema.vulnerabilities)
      .where(eq(schema.vulnerabilities.status, "open"));
    const [vulnCritical] = await db
      .select({ n: count() })
      .from(schema.vulnerabilities)
      .where(
        and(
          eq(schema.vulnerabilities.status, "open"),
          eq(schema.vulnerabilities.severity, "critical")
        )
      );

    // ── Incidents (events with severity critical/high that are "open") ──
    // For now, approximate as critical+high events total
    const [incidentsOpen] = await db
      .select({ n: count() })
      .from(schema.events)
      .where(sql`${schema.events.severity} IN ('critical', 'high')`);

    return {
      node_id: identity.nodeId,
      company: identity.company,
      role: identity.role,
      peers: {
        online: peersTotal?.n ?? 0, // all registered peers considered "online" for now
        total: peersTotal?.n ?? 0,
      },
      events: {
        total: eventsTotal?.n ?? 0,
        last_24h: eventsLast24h?.n ?? 0,
        critical_24h: eventsCritical24h?.n ?? 0,
      },
      indicators: {
        total: indicatorsTotal?.n ?? 0,
        tlp_red: indicatorsTlpRed?.n ?? 0,
        tlp_amber: indicatorsTlpAmber?.n ?? 0,
      },
      incidents: {
        open: incidentsOpen?.n ?? 0,
      },
      vulnerabilities: {
        open: vulnOpen?.n ?? 0,
        critical: vulnCritical?.n ?? 0,
      },
    };
  })
  .get("/vulnerabilities", async () => {
    const db = getDbInstance();
    return await db.select().from(schema.vulnerabilities);
  })
  .get("/tools", async () => {
    const db = getDbInstance();
    return await db.select().from(schema.tools);
  });
