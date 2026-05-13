#!/usr/bin/env bun
// Smoke-test: spawns two simulated "node" WS clients, has them HELLO into
// varde-svc, then has node A send a signed EVENT and verifies node B
// receives it via fan-out.

import { generateKeypair, signObject } from "@nordlys/crypto";
import { randomUUID } from "node:crypto";

const VARDE_WS_URL = process.env.VARDE_WS_URL ?? "ws://localhost:3020/ws";
const VARDE_HTTP_URL = process.env.VARDE_HTTP_URL ?? "http://localhost:3020";

interface NodeSim {
  nodeId: string;
  company: string;
  publicKey: string;
  privateKey: string;
  ws: WebSocket;
  received: unknown[];
  outboundSeq: number;
}

async function main() {
  // 1. Pre-register both simulated nodes in core-svc's peer table by self-
  //    posting their identities. We bypass invite-token flow for this test.
  const nodeA = newNode("hafslund-1", "Hafslund");
  const nodeB = newNode("statkraft-1", "Statkraft");

  await registerWithCore(nodeA);
  await registerWithCore(nodeB);
  console.log("[smoke] both nodes registered in core-svc peer table");

  // 2. Connect each simulated node to varde-svc via WS.
  await Promise.all([connect(nodeA), connect(nodeB)]);
  await sendHello(nodeA);
  await sendHello(nodeB);
  await wait(300);
  console.log("[smoke] HELLO sent for both nodes");

  // 3. Node A creates and sends a signed EVENT.
  const event = signEvent(nodeA, {
    title: "Smoke event A",
    description: "Sent from Hafslund through Varde to Statkraft",
    severity: "high",
  });
  send(nodeA, { type: "EVENT", event });
  console.log(`[smoke] node A sent EVENT id=${event.id}`);

  // 4. Wait for node B to receive it.
  await wait(500);

  const receivedByB = nodeB.received.find(
    (m) =>
      typeof m === "object" &&
      m !== null &&
      (m as { type: string }).type === "EVENT" &&
      (m as { event: { id: string } }).event.id === event.id,
  );
  if (receivedByB) {
    console.log(`[smoke] ✅ node B received EVENT id=${event.id}`);
  } else {
    console.error(
      `[smoke] ❌ node B did not receive EVENT — got: ${JSON.stringify(nodeB.received).slice(0, 400)}`,
    );
    process.exit(1);
  }

  // 5. Node A sends PING and expects PONG.
  send(nodeA, { type: "PING" });
  await wait(200);
  const pong = nodeA.received.find(
    (m) => typeof m === "object" && m !== null && (m as { type: string }).type === "PONG",
  );
  if (pong) {
    console.log("[smoke] ✅ node A got PONG");
  } else {
    console.error("[smoke] ❌ no PONG");
    process.exit(1);
  }

  console.log("[smoke] all checks passed");
  nodeA.ws.close();
  nodeB.ws.close();
  process.exit(0);
}

// ── helpers ──────────────────────────────────────────────────────────────

function newNode(nodeId: string, company: string): NodeSim {
  const { publicKey, privateKey } = generateKeypair();
  return {
    nodeId,
    company,
    publicKey,
    privateKey,
    ws: undefined as unknown as WebSocket,
    received: [],
    outboundSeq: 0,
  };
}

async function registerWithCore(node: NodeSim): Promise<void> {
  // Seeds the peer record on the Varde so HELLO + EVENT signature checks
  // can succeed. Only works when varde-svc is started with
  // VARDE_TEST_MODE=true.
  const res = await fetch(`${VARDE_HTTP_URL}/test/upsert-peer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      node_id: node.nodeId,
      company: node.company,
      public_key: node.publicKey,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `varde-svc /test/upsert-peer ${res.status}: ${await res.text()}`,
    );
  }
}

function connect(node: NodeSim): Promise<void> {
  return new Promise((resolve, reject) => {
    node.ws = new WebSocket(VARDE_WS_URL);
    node.ws.addEventListener("open", () => resolve());
    node.ws.addEventListener("error", (e) => reject(e));
    node.ws.addEventListener("message", (ev) => {
      try {
        node.received.push(JSON.parse(ev.data as string));
      } catch {
        node.received.push(ev.data);
      }
    });
  });
}

async function sendHello(node: NodeSim): Promise<void> {
  send(node, {
    type: "HELLO",
    node_id: node.nodeId,
    company: node.company,
    public_key: node.publicKey,
  });
}

function send(node: NodeSim, msg: Record<string, unknown>): void {
  node.outboundSeq++;
  node.ws.send(JSON.stringify({ ...msg, seq: node.outboundSeq }));
}

function signEvent(
  node: NodeSim,
  partial: { title: string; description: string; severity: string },
) {
  const event = {
    id: randomUUID(),
    node_id: node.nodeId,
    company: node.company,
    title: partial.title,
    description: partial.description,
    severity: partial.severity,
    source: "manual" as const,
    external_ref: "",
    scenario_id: "",
    created_at: new Date().toISOString(),
  };
  const signature = signObject(event, node.privateKey);
  return { ...event, signature };
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

await main();
