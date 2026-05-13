import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  EventCore,
  SignedEvent,
  EventIngestInput,
  IndicatorCore,
  SignedIndicator,
  IndicatorIngestInput,
  PeerIdentity,
  SignedPeerIdentity,
  InviteToken,
  AuditLogEntry,
  AuditOutcome,
  NodeId,
  Severity,
  TLP,
  Uuid,
  IsoTimestamp,
  Ed25519PublicKey,
  Ed25519Signature,
  EventSource,
  IndicatorType,
} from "./index";

// Canonical valid fixtures
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_TS = "2026-05-01T12:00:00.000Z";
const VALID_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; // 32-byte base64
const VALID_SIG = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; // 64-byte base64

const validEventCore = {
  id: VALID_UUID,
  node_id: "hafslund-1",
  company: "Hafslund",
  title: "Suspicious login",
  description: "Brute force attempt",
  severity: "high",
  source: "siem",
  external_ref: "splunk-12345",
  scenario_id: "brute-force",
  created_at: VALID_TS,
} satisfies EventCore;

const validSignedEvent = {
  ...validEventCore,
  signature: VALID_SIG,
} satisfies SignedEvent;

const validPeerIdentity = {
  node_id: "statkraft-1",
  company: "Statkraft",
  public_key: VALID_KEY,
  registered_at: VALID_TS,
  registered_by: "kraftcert",
} satisfies PeerIdentity;

describe("Primitive schemas", () => {
  test("NodeId accepts valid lowercase alphanumeric IDs", () => {
    expect(Value.Check(NodeId, "hafslund-1")).toBe(true);
    expect(Value.Check(NodeId, "node-abc-123")).toBe(true);
  });

  test("NodeId rejects IDs with uppercase letters", () => {
    expect(Value.Check(NodeId, "Hafslund-1")).toBe(false);
  });

  test("NodeId rejects IDs shorter than 3 characters", () => {
    expect(Value.Check(NodeId, "ab")).toBe(false);
  });

  test("Severity accepts all four levels", () => {
    for (const level of ["low", "medium", "high", "critical"] as const) {
      expect(Value.Check(Severity, level)).toBe(true);
    }
  });

  test("Severity rejects unknown levels", () => {
    expect(Value.Check(Severity, "extreme")).toBe(false);
    expect(Value.Check(Severity, "")).toBe(false);
  });

  test("TLP accepts valid classifications", () => {
    for (const tlp of ["RED", "AMBER", "GREEN", "WHITE"] as const) {
      expect(Value.Check(TLP, tlp)).toBe(true);
    }
  });

  test("Uuid accepts RFC 4122 UUID v4 strings", () => {
    expect(Value.Check(Uuid, VALID_UUID)).toBe(true);
  });

  test("Uuid rejects non-UUID strings", () => {
    expect(Value.Check(Uuid, "not-a-uuid")).toBe(false);
  });

  test("IsoTimestamp accepts valid ISO 8601 strings", () => {
    expect(Value.Check(IsoTimestamp, VALID_TS)).toBe(true);
  });

  test("EventSource accepts all declared source types", () => {
    const valid: EventSource[] = ["manual", "siem", "syslog", "scanner", "scada", "mqtt", "custom"];
    for (const s of valid) {
      expect(Value.Check(EventSource, s)).toBe(true);
    }
  });

  test("EventSource rejects unknown sources", () => {
    expect(Value.Check(EventSource, "kafka")).toBe(false);
  });

  test("IndicatorType accepts all declared types", () => {
    const valid: IndicatorType[] = ["ip", "domain", "hash", "url", "ttp", "email"];
    for (const t of valid) {
      expect(Value.Check(IndicatorType, t)).toBe(true);
    }
  });
});

describe("EventCore schema", () => {
  test("validates a well-formed EventCore", () => {
    expect(Value.Check(EventCore, validEventCore)).toBe(true);
  });

  test("rejects EventCore with missing title", () => {
    const { title: _, ...withoutTitle } = validEventCore;
    expect(Value.Check(EventCore, withoutTitle)).toBe(false);
  });

  test("rejects EventCore with invalid severity", () => {
    expect(Value.Check(EventCore, { ...validEventCore, severity: "extreme" })).toBe(false);
  });

  test("rejects EventCore with title exceeding 200 characters", () => {
    expect(Value.Check(EventCore, { ...validEventCore, title: "x".repeat(201) })).toBe(false);
  });

  test("rejects EventCore with invalid node_id format", () => {
    expect(Value.Check(EventCore, { ...validEventCore, node_id: "Has Spaces" })).toBe(false);
  });
});

describe("SignedEvent schema", () => {
  test("validates a well-formed SignedEvent", () => {
    expect(Value.Check(SignedEvent, validSignedEvent)).toBe(true);
  });

  test("rejects SignedEvent without signature field", () => {
    const { signature: _, ...withoutSig } = validSignedEvent;
    expect(Value.Check(SignedEvent, withoutSig)).toBe(false);
  });

  test("accepts SignedEvent with optional recipients array", () => {
    const withRecipients = { ...validSignedEvent, recipients: ["hafslund-1", "statkraft-1"] };
    expect(Value.Check(SignedEvent, withRecipients)).toBe(true);
  });
});

describe("EventIngestInput schema", () => {
  test("validates minimal ingest input (required fields only)", () => {
    const minimal: EventIngestInput = {
      title: "Test event",
      severity: "low",
      source: "manual",
    };
    expect(Value.Check(EventIngestInput, minimal)).toBe(true);
  });

  test("rejects ingest input with empty title", () => {
    expect(Value.Check(EventIngestInput, { title: "", severity: "low", source: "manual" })).toBe(false);
  });

  test("rejects ingest input with unknown source", () => {
    expect(Value.Check(EventIngestInput, { title: "T", severity: "low", source: "kafka" })).toBe(false);
  });
});

describe("IndicatorCore schema", () => {
  test("validates a well-formed IndicatorCore", () => {
    const indicator: IndicatorCore = {
      id: VALID_UUID,
      node_id: "hafslund-1",
      company: "Hafslund",
      type: "ip",
      value: "192.168.1.100",
      tlp: "GREEN",
      description: "Suspicious source IP",
      severity: "medium",
      created_at: VALID_TS,
    };
    expect(Value.Check(IndicatorCore, indicator)).toBe(true);
  });

  test("rejects IndicatorCore with invalid TLP", () => {
    const indicator: IndicatorCore = {
      id: VALID_UUID,
      node_id: "hafslund-1",
      company: "Hafslund",
      type: "ip",
      value: "192.168.1.1",
      tlp: "GREEN",
      description: "",
      severity: "low",
      created_at: VALID_TS,
    };
    expect(Value.Check(IndicatorCore, { ...indicator, tlp: "PURPLE" })).toBe(false);
  });
});

describe("PeerIdentity schema", () => {
  test("validates a well-formed PeerIdentity", () => {
    expect(Value.Check(PeerIdentity, validPeerIdentity)).toBe(true);
  });

  test("rejects PeerIdentity with empty company", () => {
    expect(Value.Check(PeerIdentity, { ...validPeerIdentity, company: "" })).toBe(false);
  });

  test("rejects PeerIdentity with invalid node_id", () => {
    expect(Value.Check(PeerIdentity, { ...validPeerIdentity, node_id: "Node With Spaces" })).toBe(false);
  });
});

describe("AuditLogEntry schema", () => {
  test("validates a well-formed AuditLogEntry", () => {
    const entry = {
      id: VALID_UUID,
      ts: VALID_TS,
      actor: "splunk-prod",
      method: "POST",
      path: "/ingest/siem",
      status_code: 200,
      outcome: "allowed",
      duration_ms: 55,
    };
    expect(Value.Check(AuditLogEntry, entry)).toBe(true);
  });

  test("rejects AuditLogEntry with invalid outcome value", () => {
    const entry = {
      id: VALID_UUID,
      ts: VALID_TS,
      actor: "x",
      method: "GET",
      path: "/",
      status_code: 200,
      outcome: "permitted", // invalid
      duration_ms: 10,
    };
    expect(Value.Check(AuditLogEntry, entry)).toBe(false);
  });

  test("AuditOutcome accepts all three valid literals", () => {
    for (const o of ["allowed", "denied", "error"] as const) {
      expect(Value.Check(AuditOutcome, o)).toBe(true);
    }
  });
});
