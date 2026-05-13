import { eq } from "drizzle-orm";
import { type Db, schema } from "@nordlys/db";
import type { PeerWithStatus, Revocation, SignedPeerIdentity } from "@nordlys/contracts";

export async function upsertPeer(
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
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.peers.nodeId,
      set: {
        company: peer.company,
        publicKey: peer.public_key,
        signature: peer.signature,
        signedBy: peer.signed_by,
        lastSeenAt: new Date(),
      },
    });
}

/** Update last_seen_at for a peer (heartbeat). */
export async function touchLastSeen(
  db: Db,
  nodeId: string,
): Promise<boolean> {
  const result = await db
    .update(schema.peers)
    .set({ lastSeenAt: new Date() })
    .where(eq(schema.peers.nodeId, nodeId));
  return (result.rowCount ?? 0) > 0;
}

export async function getPeer(
  db: Db,
  nodeId: string,
): Promise<PeerWithStatus | null> {
  const [row] = await db
    .select()
    .from(schema.peers)
    .where(eq(schema.peers.nodeId, nodeId))
    .limit(1);
  return row ? rowToPeer(row) : null;
}

export async function listPeers(db: Db): Promise<PeerWithStatus[]> {
  const rows = await db.select().from(schema.peers);
  return rows.map(rowToPeer);
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

type PeerRow = typeof schema.peers.$inferSelect;

function rowToPeer(row: PeerRow): PeerWithStatus {
  return {
    node_id: row.nodeId,
    company: row.company,
    public_key: row.publicKey,
    registered_at: row.registeredAt.toISOString(),
    registered_by: row.registeredBy,
    signature: row.signature,
    signed_by: row.signedBy,
    last_seen_at: row.lastSeenAt?.toISOString(),
  };
}
