// Retention / compaction for events.
//
// Primary path (partitioned table, TODO #41):  dropOldEventPartitions() — drops
// entire weekly partition tables, which is instant and has zero VACUUM overhead.
//
// Fallback path (flat table or partitions not available): row-by-row DELETE,
// same as the pre-partition behaviour. Keeps the service functional when
// running against a schema that has not yet been migrated.

import { lt, sql } from "drizzle-orm";
import { schema } from "@nordlys/db";
import { config } from "./config";
import { getDbInstance } from "./db";
import { dropOldEventPartitions } from "./partitions";

async function isEventsPartitioned(): Promise<boolean> {
  const db = getDbInstance();
  try {
    // RowList<T[]> from postgres-js is array-like; spread to check length.
    const rows = await db.execute<{ relkind: string }>(
      sql.raw(`SELECT relkind FROM pg_class WHERE relname = 'events' AND relkind = 'p'`),
    );
    return [...rows].length > 0;
  } catch {
    return false;
  }
}

async function sweepOnce(): Promise<void> {
  if (config.eventRetentionDays <= 0) return;

  try {
    if (await isEventsPartitioned()) {
      // Fast path: drop whole weekly partitions older than the retention window.
      await dropOldEventPartitions(config.eventRetentionDays);
    } else {
      // Fallback: row-level DELETE (pre-partition schema or test environment).
      const db = getDbInstance();
      const cutoff = sql<Date>`NOW() - INTERVAL '${sql.raw(String(config.eventRetentionDays))} days'`;
      const result = await db
        .delete(schema.events)
        .where(lt(schema.events.createdAt, cutoff))
        .returning({ id: schema.events.id });
      if (result.length > 0) {
        console.log(
          `[varde-svc] retention sweep (DELETE fallback): removed ${result.length} events older than ${config.eventRetentionDays} days`,
        );
      }
    }
  } catch (err) {
    console.warn(`[varde-svc] retention sweep failed:`, err);
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startRetention(): void {
  if (config.eventRetentionDays <= 0) {
    console.log("[varde-svc] retention disabled (EVENT_RETENTION_DAYS <= 0)");
    return;
  }
  console.log(
    `[varde-svc] retention sweep: every ${config.retentionSweepIntervalMs}ms, TTL=${config.eventRetentionDays} days`,
  );
  // Run once on startup, then on the configured cadence.
  void sweepOnce();
  timer = setInterval(() => {
    void sweepOnce();
  }, config.retentionSweepIntervalMs);
}

export function stopRetention(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
