// Partition management for the events (weekly) and audit_log (monthly) tables.
// Metrics are recorded per-run in ensureUpcomingPartitions().
// Call ensureUpcomingPartitions() at startup and on a daily cron to guarantee
// that a named partition always exists for inserts arriving in the next period.
// Call dropOldPartitions() to remove expired partitions instead of row-by-row
// DELETE — vastly cheaper at scale (no VACUUM overhead, instant space reclaim).

import { sql } from "drizzle-orm";
import { getDbInstance } from "./db";
import { partitionManagementRunsTotal } from "./metrics";

// ── helpers ───────────────────────────────────────────────────────────────

function isoWeekLabel(d: Date): string {
  // Returns "YYYY_WW" e.g. "2026_18"
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const weekNumber =
    Math.floor((d.getTime() - startOfWeek1.getTime()) / (7 * 24 * 3600 * 1000)) + 1;
  const year = d.getFullYear();
  const ww = String(weekNumber).padStart(2, "0");
  return `${year}_${ww}`;
}

/** Monday of the ISO week containing d. */
function startOfIsoWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// ── events (weekly) ───────────────────────────────────────────────────────

/** Ensure a named partition exists for the ISO week containing `weekDate`. */
export async function ensureEventsWeekPartition(weekDate: Date): Promise<void> {
  const db = getDbInstance();
  const weekStart = startOfIsoWeek(weekDate);
  const weekEnd = addDays(weekStart, 7);
  const label = isoWeekLabel(weekStart);
  const tableName = `events_w${label}`;

  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${tableName}"
        PARTITION OF events
        FOR VALUES FROM ('${toDateStr(weekStart)}') TO ('${toDateStr(weekEnd)}')
    `));
    console.log(`[partitions] ensured events partition ${tableName}`);
  } catch (err) {
    console.warn(`[partitions] could not create events partition ${tableName}:`, err);
  }
}

// ── audit_log (monthly) ───────────────────────────────────────────────────

/** Ensure a named partition exists for the calendar month containing `monthDate`. */
export async function ensureAuditLogMonthPartition(monthDate: Date): Promise<void> {
  const db = getDbInstance();
  const monthStart = startOfMonth(monthDate);
  const monthEnd = addMonths(monthDate, 1);
  const label = `${monthStart.getFullYear()}_${String(monthStart.getMonth() + 1).padStart(2, "0")}`;
  const tableName = `audit_log_m${label}`;

  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${tableName}"
        PARTITION OF audit_log
        FOR VALUES FROM ('${toDateStr(monthStart)}') TO ('${toDateStr(monthEnd)}')
    `));
    console.log(`[partitions] ensured audit_log partition ${tableName}`);
  } catch (err) {
    console.warn(`[partitions] could not create audit_log partition ${tableName}:`, err);
  }
}

// ── ensure upcoming (called at startup + daily) ───────────────────────────

/** Create partitions for the current period and one period ahead. */
export async function ensureUpcomingPartitions(): Promise<void> {
  const now = new Date();
  try {
    // events: this week + next week
    await ensureEventsWeekPartition(now);
    await ensureEventsWeekPartition(addDays(now, 7));

    // audit_log: this month + next month
    await ensureAuditLogMonthPartition(now);
    await ensureAuditLogMonthPartition(addMonths(now, 1));

    partitionManagementRunsTotal.inc({ result: "success" });
  } catch (err) {
    partitionManagementRunsTotal.inc({ result: "fail" });
    throw err;
  }
}

// ── drop old partitions ───────────────────────────────────────────────────

/**
 * Drop events_w* partitions whose upper bound is older than `olderThanDays`.
 * Falls back gracefully if the table is not partitioned (e.g. in test envs
 * that still use the flat schema).
 */
export async function dropOldEventPartitions(olderThanDays: number): Promise<void> {
  const db = getDbInstance();
  const cutoff = addDays(new Date(), -olderThanDays);

  let names: string[];
  try {
    const rows = await db.execute<{ relname: string }>(sql.raw(`
      SELECT c.relname
      FROM   pg_class c
      JOIN   pg_inherits i ON i.inhrelid = c.oid
      JOIN   pg_class p    ON p.oid = i.inhparent
      WHERE  p.relname = 'events'
        AND  c.relname LIKE 'events_w%'
        AND  c.relname != 'events_default'
    `));
    // RowList<T[]> from postgres-js is array-like; spread to a plain array.
    names = [...rows].map((r) => r.relname);
  } catch (err) {
    console.warn("[partitions] could not list event partitions (table not partitioned?):", err);
    return;
  }

  for (const name of names) {
    try {
      const bounds = await db.execute<{ upper_bound: string }>(sql.raw(`
        SELECT pg_get_expr(c.relpartbound, c.oid) AS upper_bound
        FROM   pg_class c
        WHERE  c.relname = '${name}'
      `));
      const [bound] = [...bounds];
      if (!bound) continue;

      // e.g. FOR VALUES FROM ('2026-01-01') TO ('2026-01-08')
      const match = bound.upper_bound.match(/TO \('([^']+)'\)/);
      const upperStr = match?.[1];
      if (!upperStr) continue;
      const upperBound = new Date(upperStr);
      if (upperBound <= cutoff) {
        await db.execute(sql.raw(`DROP TABLE IF EXISTS "${name}"`));
        console.log(`[partitions] dropped old events partition ${name} (upper=${upperStr})`);
      }
    } catch (err) {
      console.warn(`[partitions] could not evaluate partition ${name}:`, err);
    }
  }
}

/**
 * Drop audit_log_m* partitions whose upper bound is older than `olderThanMonths`.
 */
export async function dropOldAuditLogPartitions(olderThanMonths: number): Promise<void> {
  const db = getDbInstance();
  const cutoff = addMonths(new Date(), -olderThanMonths);

  let names: string[];
  try {
    const rows = await db.execute<{ relname: string }>(sql.raw(`
      SELECT c.relname
      FROM   pg_class c
      JOIN   pg_inherits i ON i.inhrelid = c.oid
      JOIN   pg_class p    ON p.oid = i.inhparent
      WHERE  p.relname = 'audit_log'
        AND  c.relname LIKE 'audit_log_m%'
        AND  c.relname != 'audit_log_default'
    `));
    names = [...rows].map((r) => r.relname);
  } catch (err) {
    console.warn("[partitions] could not list audit_log partitions (table not partitioned?):", err);
    return;
  }

  for (const name of names) {
    try {
      const bounds = await db.execute<{ upper_bound: string }>(sql.raw(`
        SELECT pg_get_expr(c.relpartbound, c.oid) AS upper_bound
        FROM   pg_class c
        WHERE  c.relname = '${name}'
      `));
      const [bound] = [...bounds];
      if (!bound) continue;

      const match = bound.upper_bound.match(/TO \('([^']+)'\)/);
      const upperStr = match?.[1];
      if (!upperStr) continue;
      const upperBound = new Date(upperStr);
      if (upperBound <= cutoff) {
        await db.execute(sql.raw(`DROP TABLE IF EXISTS "${name}"`));
        console.log(`[partitions] dropped old audit_log partition ${name} (upper=${upperStr})`);
      }
    } catch (err) {
      console.warn(`[partitions] could not evaluate audit_log partition ${name}:`, err);
    }
  }
}
