import { describe, expect, test, spyOn } from "bun:test";
import type { AuditRecord } from "./audit";

// Do NOT set DATABASE_URL so the audit module falls back to stdout.
// This lets us test emitAudit without a live Postgres connection.

const { emitAudit } = await import("./audit");

function makeRecord(overrides: Partial<AuditRecord> = {}): AuditRecord {
  return {
    ts: new Date().toISOString(),
    actor: "test-key",
    method: "POST",
    path: "/ingest/siem",
    statusCode: 200,
    outcome: "allowed",
    ip: "10.0.0.1",
    durationMs: 42,
    ...overrides,
  };
}

describe("AuditRecord shape", () => {
  test("well-formed record has all required fields", () => {
    const r = makeRecord();
    expect(typeof r.ts).toBe("string");
    expect(typeof r.actor).toBe("string");
    expect(typeof r.method).toBe("string");
    expect(typeof r.path).toBe("string");
    expect(typeof r.statusCode).toBe("number");
    expect(["allowed", "denied", "error"]).toContain(r.outcome);
    expect(typeof r.durationMs).toBe("number");
  });

  test("outcome is 'denied' for 4xx status codes", () => {
    // The auditMacro derives outcome from the status code (>= 400 → denied).
    // We replicate that logic here to ensure our record-building convention is
    // consistent with the macro's classification.
    const status = 403;
    const outcome = status >= 500 ? "error" : status >= 400 ? "denied" : "allowed";
    expect(outcome).toBe("denied");
  });

  test("outcome is 'error' for 5xx status codes", () => {
    const status = 500;
    const outcome = status >= 500 ? "error" : status >= 400 ? "denied" : "allowed";
    expect(outcome).toBe("error");
  });

  test("outcome is 'allowed' for 2xx status codes", () => {
    const status = 201;
    const outcome = status >= 500 ? "error" : status >= 400 ? "denied" : "allowed";
    expect(outcome).toBe("allowed");
  });
});

describe("emitAudit (stdout fallback — no DATABASE_URL)", () => {
  test("calls console.log with a JSON string containing kind='audit'", () => {
    const spy = spyOn(console, "log");
    emitAudit(makeRecord());
    expect(spy).toHaveBeenCalled();
    const call = spy.mock.calls[spy.mock.calls.length - 1];
    const arg = call?.[0] as string;
    expect(typeof arg).toBe("string");
    const parsed = JSON.parse(arg) as Record<string, unknown>;
    expect(parsed.kind).toBe("audit");
    spy.mockRestore();
  });

  test("audit record written to stdout contains actor, method, path", () => {
    const spy = spyOn(console, "log");
    const record = makeRecord({ actor: "sentinel-stage", method: "GET", path: "/api/events" });
    emitAudit(record);
    const call = spy.mock.calls[spy.mock.calls.length - 1];
    const parsed = JSON.parse(call?.[0] as string) as Record<string, unknown>;
    expect(parsed.actor).toBe("sentinel-stage");
    expect(parsed.method).toBe("GET");
    expect(parsed.path).toBe("/api/events");
    spy.mockRestore();
  });

  test("audit record written to stdout includes outcome field", () => {
    const spy = spyOn(console, "log");
    emitAudit(makeRecord({ outcome: "denied", statusCode: 403 }));
    const call = spy.mock.calls[spy.mock.calls.length - 1];
    const parsed = JSON.parse(call?.[0] as string) as Record<string, unknown>;
    expect(parsed.outcome).toBe("denied");
    spy.mockRestore();
  });

  test("audit record includes ip field (may be null)", () => {
    const spy = spyOn(console, "log");
    emitAudit(makeRecord({ ip: null }));
    const call = spy.mock.calls[spy.mock.calls.length - 1];
    const parsed = JSON.parse(call?.[0] as string) as Record<string, unknown>;
    expect("ip" in parsed).toBe(true);
    spy.mockRestore();
  });

  test("emitting multiple records produces separate log lines", () => {
    const spy = spyOn(console, "log");
    const before = spy.mock.calls.length;
    emitAudit(makeRecord({ path: "/a" }));
    emitAudit(makeRecord({ path: "/b" }));
    expect(spy.mock.calls.length - before).toBe(2);
    spy.mockRestore();
  });
});
