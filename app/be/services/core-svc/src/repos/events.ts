import { and, desc, eq, gte } from "drizzle-orm";
import { type Db, schema } from "@nordlys/db";
import type { SignedEvent } from "@nordlys/contracts";

export async function insertEvent(
  db: Db,
  event: SignedEvent,
): Promise<SignedEvent> {
  const [row] = await db
    .insert(schema.events)
    .values({
      id: event.id,
      nodeId: event.node_id,
      company: event.company,
      title: event.title,
      description: event.description,
      severity: event.severity,
      source: event.source,
      externalRef: event.external_ref,
      scenarioId: event.scenario_id,
      createdAt: new Date(event.created_at),
      signature: event.signature,
      recipients: event.recipients ?? null,
    })
    .onConflictDoNothing({
      target: [schema.events.id, schema.events.createdAt],
    })
    .returning();
  if (!row) {
    // Conflict on id → existing event is the source of truth; fetch it.
    return await getEventById(db, event.id) ?? event;
  }
  return rowToEvent(row);
}

export async function getEventById(
  db: Db,
  id: string,
): Promise<SignedEvent | null> {
  const [row] = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.id, id))
    .limit(1);
  return row ? rowToEvent(row) : null;
}

export async function listEvents(
  db: Db,
  limit = 200,
): Promise<SignedEvent[]> {
  const rows = await db
    .select()
    .from(schema.events)
    .orderBy(desc(schema.events.createdAt))
    .limit(limit);
  return rows.map(rowToEvent);
}

export async function countEventsLastHour(
  db: Db,
  severity: string,
): Promise<number> {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const rows = await db
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(
      and(
        eq(schema.events.severity, severity),
        gte(schema.events.createdAt, cutoff),
      ),
    );
  return rows.length;
}

type EventRow = typeof schema.events.$inferSelect;

function rowToEvent(row: EventRow): SignedEvent {
  const base = {
    id: row.id,
    node_id: row.nodeId,
    company: row.company,
    title: row.title,
    description: row.description,
    severity: row.severity as SignedEvent["severity"],
    source: row.source as SignedEvent["source"],
    external_ref: row.externalRef,
    scenario_id: row.scenarioId,
    created_at: row.createdAt.toISOString(),
    signature: row.signature,
  };
  return row.recipients ? { ...base, recipients: row.recipients } : base;
}
