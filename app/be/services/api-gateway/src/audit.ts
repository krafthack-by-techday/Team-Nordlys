import { Elysia } from "elysia";
import { schema, getDb, type Db } from "@nordlys/db";
import type { Actor } from "./auth";
import { auditWritesTotal } from "./metrics";

export interface AuditRecord {
  ts: string;
  actor: string;
  method: string;
  path: string;
  statusCode: number;
  outcome: "allowed" | "denied" | "error";
  ip: string | null;
  durationMs: number;
}

// Audit sink: writes to Postgres `audit_log` when DATABASE_URL is set;
// otherwise falls back to structured JSON on stdout (useful in tests and
// during early bring-up before the DB is provisioned). A small in-memory
// queue + best-effort flush keeps request handlers off the DB hot path.

let db: Db | null = null;
try {
  if (process.env.DATABASE_URL) {
    db = getDb(process.env.DATABASE_URL).db;
  }
} catch (err) {
  console.warn("[api-gateway] audit DB init failed; falling back to stdout:", err);
}

const queue: AuditRecord[] = [];
let flushing = false;

export function emitAudit(record: AuditRecord): void {
  if (!db) {
    console.log(JSON.stringify({ kind: "audit", ...record }));
    return;
  }
  queue.push(record);
  if (!flushing) void flush();
}

async function flush(): Promise<void> {
  if (!db || flushing) return;
  flushing = true;
  try {
    while (queue.length > 0) {
      // Drain in batches of up to 100 to keep round-trips small.
      const batch = queue.splice(0, 100);
      try {
        await db.insert(schema.auditLog).values(
          batch.map((r) => ({
            ts: new Date(r.ts),
            actor: r.actor,
            method: r.method,
            path: r.path,
            statusCode: r.statusCode,
            outcome: r.outcome,
            ip: r.ip,
            durationMs: r.durationMs,
          })),
        );
        auditWritesTotal.inc({ outcome: "success" });
      } catch (err) {
        console.warn("[api-gateway] audit flush failed:", err);
        auditWritesTotal.inc({ outcome: "fail" });
        // Drop the batch to avoid an infinite loop. Audit is best-effort —
        // structured stdout above remains the durable record on flush failure.
        for (const record of batch) {
          console.log(JSON.stringify({ kind: "audit", ...record }));
        }
      }
    }
  } finally {
    flushing = false;
  }
}

export const auditMacro = new Elysia({ name: "audit" }).onAfterResponse(
  ({ request, set, store }) => {
    const start = (store as { _auditStart?: number })._auditStart ?? Date.now();
    const actor = (store as { actor?: Actor }).actor ?? { kind: "anonymous" };
    const status = (set.status as number) ?? 200;
    const url = new URL(request.url);
    emitAudit({
      ts: new Date().toISOString(),
      actor: actor.kind === "api-key" ? actor.name : "anonymous",
      method: request.method,
      path: url.pathname,
      statusCode: status,
      outcome: status >= 500 ? "error" : status >= 400 ? "denied" : "allowed",
      ip: request.headers.get("x-forwarded-for") ?? null,
      durationMs: Date.now() - start,
    });
  },
).onRequest(({ store }) => {
  (store as { _auditStart?: number })._auditStart = Date.now();
});
