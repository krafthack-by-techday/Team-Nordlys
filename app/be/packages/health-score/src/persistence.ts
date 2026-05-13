/**
 * Optional SQLite persistence for health scores — enables warm restart.
 * Uses Bun's built-in SQLite. Scores are persisted periodically and
 * restored on startup.
 */

import type { VardeHealthState } from "./score";

let db: any = null;

export function initPersistence(dbPath: string): void {
  try {
    const { Database } = require("bun:sqlite");
    // Ensure parent directory exists
    const dir = dbPath.replace(/\/[^/]+$/, "");
    if (dir && dir !== dbPath) {
      const { mkdirSync } = require("node:fs");
      mkdirSync(dir, { recursive: true });
    }
    db = new Database(dbPath);
    db.run(`
      CREATE TABLE IF NOT EXISTS health_scores (
        varde_id TEXT PRIMARY KEY,
        score REAL NOT NULL,
        disconnect_count INTEGER NOT NULL DEFAULT 0,
        last_rtt_ms REAL,
        last_delivery_latency_ms REAL,
        updated_at INTEGER NOT NULL
      )
    `);
  } catch (err) {
    console.warn("[health-score] persistence init failed, running in-memory only:", (err as Error).message);
    db = null;
  }
}

export function persistState(state: VardeHealthState): void {
  if (!db) return;
  db.query(
    `INSERT OR REPLACE INTO health_scores (varde_id, score, disconnect_count, last_rtt_ms, last_delivery_latency_ms, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(state.vardeId, state.score, state.disconnectCount, state.lastRttMs, state.lastDeliveryLatencyMs, state.lastUpdate);
}

export function restoreState(vardeId: string): Partial<VardeHealthState> | null {
  if (!db) return null;
  const row = db.query(
    `SELECT score, disconnect_count, last_rtt_ms, last_delivery_latency_ms, updated_at FROM health_scores WHERE varde_id = ?`
  ).get(vardeId);
  if (!row) return null;
  return {
    score: row.score,
    disconnectCount: row.disconnect_count,
    lastRttMs: row.last_rtt_ms,
    lastDeliveryLatencyMs: row.last_delivery_latency_ms,
    lastUpdate: row.updated_at,
  };
}

export function restoreAll(): Map<string, Partial<VardeHealthState>> {
  const result = new Map<string, Partial<VardeHealthState>>();
  if (!db) return result;
  const rows = db.query(`SELECT varde_id, score, disconnect_count, last_rtt_ms, last_delivery_latency_ms, updated_at FROM health_scores`).all();
  for (const row of rows) {
    result.set(row.varde_id, {
      score: row.score,
      disconnectCount: row.disconnect_count,
      lastRttMs: row.last_rtt_ms,
      lastDeliveryLatencyMs: row.last_delivery_latency_ms,
      lastUpdate: row.updated_at,
    });
  }
  return result;
}
