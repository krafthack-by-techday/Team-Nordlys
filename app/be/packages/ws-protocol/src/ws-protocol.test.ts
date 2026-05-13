import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  HelloMsg,
  PingMsg,
  EventMsg,
  ResyncMsg,
  WelcomeMsg,
  RejectedMsg,
  PongMsg,
  ClientMsg,
  ServerMsg,
} from "./index";

// Shared test fixtures
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_TS = "2026-05-01T12:00:00.000Z";
const VALID_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const VALID_SIG = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

const validSignedEvent = {
  id: VALID_UUID,
  node_id: "hafslund-1",
  company: "Hafslund",
  title: "Test event",
  description: "",
  severity: "high",
  source: "siem",
  external_ref: "",
  scenario_id: "",
  created_at: VALID_TS,
  signature: VALID_SIG,
};

describe("HelloMsg schema", () => {
  test("validates a minimal HELLO message", () => {
    const hello: HelloMsg = {
      type: "HELLO",
      seq: 0,
      node_id: "hafslund-1",
      company: "Hafslund",
      public_key: VALID_KEY,
    };
    expect(Value.Check(HelloMsg, hello)).toBe(true);
  });

  test("accepts HELLO with optional invite_token and last_event_cursor", () => {
    const hello = {
      type: "HELLO",
      seq: 1,
      node_id: "statkraft-1",
      company: "Statkraft",
      public_key: VALID_KEY,
      invite_token: "tok-abc123",
      last_event_cursor: VALID_TS,
    };
    expect(Value.Check(HelloMsg, hello)).toBe(true);
  });

  test("rejects HELLO with wrong type literal", () => {
    expect(Value.Check(HelloMsg, {
      type: "HI",
      seq: 0,
      node_id: "x-node",
      company: "X",
      public_key: VALID_KEY,
    })).toBe(false);
  });

  test("rejects HELLO with negative seq", () => {
    expect(Value.Check(HelloMsg, {
      type: "HELLO",
      seq: -1,
      node_id: "hafslund-1",
      company: "Hafslund",
      public_key: VALID_KEY,
    })).toBe(false);
  });

  test("rejects HELLO missing company", () => {
    expect(Value.Check(HelloMsg, {
      type: "HELLO",
      seq: 0,
      node_id: "hafslund-1",
      public_key: VALID_KEY,
    })).toBe(false);
  });
});

describe("PingMsg schema", () => {
  test("validates a valid PING", () => {
    expect(Value.Check(PingMsg, { type: "PING", seq: 5 })).toBe(true);
  });

  test("rejects PING with wrong type", () => {
    expect(Value.Check(PingMsg, { type: "PONG", seq: 0 })).toBe(false);
  });
});

describe("ResyncMsg schema", () => {
  test("validates RESYNC with events channel", () => {
    const msg = {
      type: "RESYNC",
      seq: 2,
      from_cursor: VALID_TS,
      channels: ["events"],
    };
    expect(Value.Check(ResyncMsg, msg)).toBe(true);
  });

  test("validates RESYNC with multiple channels", () => {
    const msg = {
      type: "RESYNC",
      seq: 3,
      from_cursor: VALID_TS,
      channels: ["events", "indicators", "chat"],
    };
    expect(Value.Check(ResyncMsg, msg)).toBe(true);
  });

  test("rejects RESYNC with unknown channel", () => {
    const msg = {
      type: "RESYNC",
      seq: 0,
      from_cursor: VALID_TS,
      channels: ["metrics"],
    };
    expect(Value.Check(ResyncMsg, msg)).toBe(false);
  });
});

describe("WelcomeMsg schema", () => {
  test("validates a valid WELCOME message", () => {
    const msg: WelcomeMsg = {
      type: "WELCOME",
      seq: 0,
      accepted: true,
      since_cursor: VALID_TS,
    };
    expect(Value.Check(WelcomeMsg, msg)).toBe(true);
  });

  test("rejects WELCOME with accepted=false (must be literal true)", () => {
    expect(Value.Check(WelcomeMsg, {
      type: "WELCOME",
      seq: 0,
      accepted: false,
      since_cursor: VALID_TS,
    })).toBe(false);
  });
});

describe("RejectedMsg schema", () => {
  test("validates a valid REJECTED message", () => {
    const msg: RejectedMsg = {
      type: "REJECTED",
      seq: 0,
      reason: "unknown_node",
    };
    expect(Value.Check(RejectedMsg, msg)).toBe(true);
  });

  test("rejects REJECTED with missing reason", () => {
    expect(Value.Check(RejectedMsg, { type: "REJECTED", seq: 0 })).toBe(false);
  });
});

describe("PongMsg schema", () => {
  test("validates a valid PONG message", () => {
    expect(Value.Check(PongMsg, { type: "PONG", seq: 1, seq_echo: 5 })).toBe(true);
  });

  test("rejects PONG without seq_echo", () => {
    expect(Value.Check(PongMsg, { type: "PONG", seq: 0 })).toBe(false);
  });
});

describe("EventMsg schema", () => {
  test("validates a valid EVENT message", () => {
    const msg = {
      type: "EVENT",
      seq: 10,
      event: validSignedEvent,
    };
    expect(Value.Check(EventMsg, msg)).toBe(true);
  });

  test("rejects EVENT with missing event payload", () => {
    expect(Value.Check(EventMsg, { type: "EVENT", seq: 0 })).toBe(false);
  });
});

describe("ClientMsg union", () => {
  test("HELLO is a valid ClientMsg", () => {
    expect(Value.Check(ClientMsg, {
      type: "HELLO",
      seq: 0,
      node_id: "node-1",
      company: "Corp",
      public_key: VALID_KEY,
    })).toBe(true);
  });

  test("PING is a valid ClientMsg", () => {
    expect(Value.Check(ClientMsg, { type: "PING", seq: 1 })).toBe(true);
  });

  test("WELCOME is not a valid ClientMsg (server-only)", () => {
    expect(Value.Check(ClientMsg, {
      type: "WELCOME",
      seq: 0,
      accepted: true,
      since_cursor: VALID_TS,
    })).toBe(false);
  });
});

describe("ServerMsg union", () => {
  test("WELCOME is a valid ServerMsg", () => {
    expect(Value.Check(ServerMsg, {
      type: "WELCOME",
      seq: 0,
      accepted: true,
      since_cursor: VALID_TS,
    })).toBe(true);
  });

  test("PONG is a valid ServerMsg", () => {
    expect(Value.Check(ServerMsg, { type: "PONG", seq: 1, seq_echo: 0 })).toBe(true);
  });

  test("HELLO is not a valid ServerMsg (client-only)", () => {
    expect(Value.Check(ServerMsg, {
      type: "HELLO",
      seq: 0,
      node_id: "node-1",
      company: "Corp",
      public_key: VALID_KEY,
    })).toBe(false);
  });
});
