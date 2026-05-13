import { desc, eq, gt } from "drizzle-orm";
import { type Db, schema } from "@nordlys/db";
import type {
  Revocation,
  SignedChatMessage,
  SignedEvent,
  SignedIndicator,
  SignedPeerIdentity,
} from "@nordlys/contracts";
import { eventsPersistedTotal } from "./metrics";

// ── Events ─────────────────────────────────────────────────────────────────

export async function dedupInsertEvent(
  db: Db,
  event: SignedEvent,
): Promise<{ inserted: boolean }> {
  const result = await db
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
    .returning({ id: schema.events.id });
  const inserted = result.length > 0;
  if (inserted) eventsPersistedTotal.inc();
  return { inserted };
}

export async function eventsSinceCursor(
  db: Db,
  cursor: Date,
  limit = 500,
): Promise<SignedEvent[]> {
  const rows = await db
    .select()
    .from(schema.events)
    .where(gt(schema.events.createdAt, cursor))
    .orderBy(schema.events.createdAt)
    .limit(limit);
  return rows.map(rowToEvent);
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

// ── Indicators ─────────────────────────────────────────────────────────────

export async function dedupInsertIndicator(
  db: Db,
  ind: SignedIndicator,
): Promise<{ inserted: boolean }> {
  const result = await db
    .insert(schema.indicators)
    .values({
      id: ind.id,
      nodeId: ind.node_id,
      company: ind.company,
      type: ind.type,
      value: ind.value,
      tlp: ind.tlp,
      description: ind.description,
      severity: ind.severity,
      createdAt: new Date(ind.created_at),
      signature: ind.signature,
      recipients: ind.recipients ?? null,
    })
    .onConflictDoNothing({ target: schema.indicators.id })
    .returning({ id: schema.indicators.id });
  return { inserted: result.length > 0 };
}

// ── Chat ───────────────────────────────────────────────────────────────────

export async function dedupInsertChat(
  db: Db,
  chat: SignedChatMessage,
): Promise<{ inserted: boolean }> {
  const result = await db
    .insert(schema.chatMessages)
    .values({
      id: chat.id,
      eventId: chat.event_id,
      nodeId: chat.node_id,
      company: chat.company,
      author: chat.author,
      message: chat.message,
      createdAt: new Date(chat.created_at),
      signature: chat.signature,
    })
    .onConflictDoNothing({ target: schema.chatMessages.id })
    .returning({ id: schema.chatMessages.id });
  return { inserted: result.length > 0 };
}

// ── Identity register (mirror of mesh-wide identities) ───────────────────

export async function upsertIdentity(
  db: Db,
  peer: SignedPeerIdentity,
): Promise<void> {
  await db
    .insert(schema.peers)
    .values({
      nodeId: peer.node_id,
      company: peer.company,
      publicKey: peer.public_key,
      registeredAt: new Date(peer.registered_at),
      registeredBy: peer.registered_by,
      signature: peer.signature,
      signedBy: peer.signed_by,
    })
    .onConflictDoUpdate({
      target: schema.peers.nodeId,
      set: {
        company: peer.company,
        publicKey: peer.public_key,
        signature: peer.signature,
        signedBy: peer.signed_by,
      },
    });
}

export async function listIdentities(
  db: Db,
): Promise<SignedPeerIdentity[]> {
  const rows = await db.select().from(schema.peers);
  return rows.map((r) => ({
    node_id: r.nodeId,
    company: r.company,
    public_key: r.publicKey,
    registered_at: r.registeredAt.toISOString(),
    registered_by: r.registeredBy,
    signature: r.signature,
    signed_by: r.signedBy,
  }));
}

export async function getIdentity(
  db: Db,
  nodeId: string,
): Promise<SignedPeerIdentity | null> {
  const [row] = await db
    .select()
    .from(schema.peers)
    .where(eq(schema.peers.nodeId, nodeId))
    .limit(1);
  if (!row) return null;
  return {
    node_id: row.nodeId,
    company: row.company,
    public_key: row.publicKey,
    registered_at: row.registeredAt.toISOString(),
    registered_by: row.registeredBy,
    signature: row.signature,
    signed_by: row.signedBy,
  };
}

export async function insertRevocation(
  db: Db,
  rev: Revocation,
): Promise<void> {
  await db
    .insert(schema.revocations)
    .values({
      nodeId: rev.node_id,
      company: rev.company,
      revokedAt: new Date(rev.revoked_at),
      reason: rev.reason,
      signedBy: rev.signed_by,
      signature: rev.signature,
    })
    .onConflictDoNothing({ target: schema.revocations.nodeId });
}

export async function listRevocations(db: Db): Promise<Revocation[]> {
  const rows = await db.select().from(schema.revocations);
  return rows.map((r) => ({
    node_id: r.nodeId,
    company: r.company,
    revoked_at: r.revokedAt.toISOString(),
    reason: r.reason,
    signed_by: r.signedBy,
    signature: r.signature,
  }));
}

export async function isRevoked(db: Db, nodeId: string): Promise<boolean> {
  const [row] = await db
    .select({ nodeId: schema.revocations.nodeId })
    .from(schema.revocations)
    .where(eq(schema.revocations.nodeId, nodeId))
    .limit(1);
  return !!row;
}

// ── Varde-roster (other Varder this Varde has seen) ──────────────────────

export async function listVardeRoster(
  db: Db,
): Promise<
  Array<{ varde_id: string; url: string; public_key: string; registered_at: string }>
> {
  const rows = await db.select().from(schema.vardeRoster);
  return rows.map((r) => ({
    varde_id: r.vardeId,
    url: r.url,
    public_key: r.publicKey,
    registered_at: r.registeredAt.toISOString(),
  }));
}

export async function upsertVardeRoster(
  db: Db,
  v: { varde_id: string; url: string; public_key: string },
): Promise<void> {
  await db
    .insert(schema.vardeRoster)
    .values({
      vardeId: v.varde_id,
      url: v.url,
      publicKey: v.public_key,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.vardeRoster.vardeId,
      set: { url: v.url, publicKey: v.public_key, lastSeenAt: new Date() },
    });
}
