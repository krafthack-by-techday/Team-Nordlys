import { desc, eq } from "drizzle-orm";
import { type Db, schema } from "@nordlys/db";
import type { SignedIndicator } from "@nordlys/contracts";

export async function insertIndicator(
  db: Db,
  ind: SignedIndicator,
): Promise<SignedIndicator> {
  const [row] = await db
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
    .returning();
  if (!row) {
    const existing = await getIndicatorById(db, ind.id);
    return existing ?? ind;
  }
  return rowToIndicator(row);
}

export async function getIndicatorById(
  db: Db,
  id: string,
): Promise<SignedIndicator | null> {
  const [row] = await db
    .select()
    .from(schema.indicators)
    .where(eq(schema.indicators.id, id))
    .limit(1);
  return row ? rowToIndicator(row) : null;
}

export async function listIndicators(
  db: Db,
  limit = 200,
): Promise<SignedIndicator[]> {
  const rows = await db
    .select()
    .from(schema.indicators)
    .orderBy(desc(schema.indicators.createdAt))
    .limit(limit);
  return rows.map(rowToIndicator);
}

type IndicatorRow = typeof schema.indicators.$inferSelect;

function rowToIndicator(row: IndicatorRow): SignedIndicator {
  const base = {
    id: row.id,
    node_id: row.nodeId,
    company: row.company,
    type: row.type as SignedIndicator["type"],
    value: row.value,
    tlp: row.tlp as SignedIndicator["tlp"],
    description: row.description,
    severity: row.severity as SignedIndicator["severity"],
    created_at: row.createdAt.toISOString(),
    signature: row.signature,
  };
  return row.recipients ? { ...base, recipients: row.recipients } : base;
}
