import { schema } from "@nordlys/db";
import { getDbInstance } from "./db";
import type { VardeCandidate } from "./rendezvous";

// The Varde roster is the union of:
//   - bootstrap URLs from env (mapped to placeholder ids at startup)
//   - VARDE_ROSTER frames received over WS (persisted to varde_roster)
// Persisting to the DB lets the node survive restart even before the next
// roster broadcast arrives.

export async function loadRosterFromDb(): Promise<VardeCandidate[]> {
  const db = getDbInstance();
  const rows = await db.select().from(schema.vardeRoster);
  return rows.map((r) => ({ varde_id: r.vardeId, url: r.url }));
}

export async function upsertVardeIntoRoster(
  v: { varde_id: string; url: string; public_key: string },
): Promise<void> {
  const db = getDbInstance();
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

export function bootstrapRoster(urls: readonly string[]): VardeCandidate[] {
  // Bootstrap candidates have synthetic ids until the WELCOME-handshake gives
  // us the real Varde-id; rendezvous still works on the synthetic id, and
  // gets corrected on the next roster broadcast.
  return urls.map((url, i) => ({ varde_id: `bootstrap-${i}`, url }));
}
