import { desc, eq } from "drizzle-orm";
import { schema } from "@nordlys/db";
import type { Scan, ScanRequest } from "@nordlys/contracts";
import { getDbInstance } from "./db";

export async function createScan(request: ScanRequest): Promise<Scan> {
  const [row] = await getDbInstance()
    .insert(schema.scans)
    .values({ request, status: "queued" })
    .returning();
  if (!row) throw new Error("failed to insert scan row");
  return rowToScan(row);
}

export async function updateScan(
  id: string,
  fields: {
    status: Scan["status"];
    startedAt?: Date;
    completedAt?: Date;
    resultSummary?: string;
    error?: string;
  },
): Promise<void> {
  const update: Record<string, unknown> = { status: fields.status };
  if (fields.startedAt) update.startedAt = fields.startedAt;
  if (fields.completedAt) update.completedAt = fields.completedAt;
  if (fields.resultSummary !== undefined) update.resultSummary = fields.resultSummary;
  if (fields.error !== undefined) update.error = fields.error;
  await getDbInstance()
    .update(schema.scans)
    .set(update)
    .where(eq(schema.scans.id, id));
}

export async function listScans(limit = 100): Promise<Scan[]> {
  const rows = await getDbInstance()
    .select()
    .from(schema.scans)
    .orderBy(desc(schema.scans.createdAt))
    .limit(limit);
  return rows.map(rowToScan);
}

export async function getScan(id: string): Promise<Scan | null> {
  const [row] = await getDbInstance()
    .select()
    .from(schema.scans)
    .where(eq(schema.scans.id, id))
    .limit(1);
  return row ? rowToScan(row) : null;
}

type ScanRow = typeof schema.scans.$inferSelect;

function rowToScan(row: ScanRow): Scan {
  const base: Scan = {
    id: row.id,
    request: row.request as ScanRequest,
    status: row.status as Scan["status"],
    created_at: row.createdAt.toISOString(),
  };
  if (row.startedAt) base.started_at = row.startedAt.toISOString();
  if (row.completedAt) base.completed_at = row.completedAt.toISOString();
  if (row.resultSummary !== null) base.result_summary = row.resultSummary;
  if (row.error !== null) base.error = row.error;
  return base;
}
