#!/usr/bin/env bun
// Full-mesh smoke test:
//
// Runs in one Bun process the equivalent of two organisations connected to
// one Varde:
//
//   node A: core-svc + mesh-svc      \
//                                     +-- varde-svc
//   node B: core-svc + mesh-svc      /
//
// We POST an event to node A's core-svc /events. core-svc signs it,
// publishes to its mesh-svc, which sends EVENT over WS to varde-svc, which
// fans out to node B's mesh-svc, which posts /inbound/events to node B's
// core-svc, which persists. We then poll node B's GET /events to confirm.
//
// Assumes Postgres is reachable and migrations have been applied to two
// distinct databases: nordlys_a and nordlys_b. The script creates them if
// missing.

import { spawn, type Subprocess } from "bun";
import { resolve } from "node:path";

const here = import.meta.dirname;
const beRoot = resolve(here, "..", "..", "..");

const PG_HOST = "localhost";
const PG_PORT = 5432;
const PG_USER = "nordlys";
const PG_PASS = "nordlys";

interface NodeStack {
  name: string;
  nodeId: string;
  company: string;
  database: string;
  corePort: number;
  meshPort: number;
  coreProc?: Subprocess;
  meshProc?: Subprocess;
}

const VARDE_HTTP = "http://localhost:3020";
const VARDE_WS = "ws://localhost:3020/ws";

const nodeA: NodeStack = {
  name: "A",
  nodeId: "hafslund-1",
  company: "Hafslund",
  database: "nordlys_a",
  corePort: 4010,
  meshPort: 4011,
};

const nodeB: NodeStack = {
  name: "B",
  nodeId: "statkraft-1",
  company: "Statkraft",
  database: "nordlys_b",
  corePort: 4020,
  meshPort: 4021,
};

async function main() {
  await ensureDbs();
  await runMigrations(nodeA);
  await runMigrations(nodeB);

  // varde-svc must already be running; we don't manage it here.
  const vardeHealth = await fetch(`${VARDE_HTTP}/health`).catch(() => null);
  if (!vardeHealth?.ok) {
    console.error(
      `[smoke] varde-svc not reachable at ${VARDE_HTTP}; start it first with VARDE_TEST_MODE=true`,
    );
    process.exit(1);
  }

  startCore(nodeA);
  startCore(nodeB);
  await waitForCore(nodeA);
  await waitForCore(nodeB);
  console.log(`[smoke] both core-svcs up`);

  // Pre-register both nodes' identities into varde-svc's local peer table
  // (test-mode shortcut). Production uses invite-token onboarding.
  const idA = await fetchIdentity(nodeA);
  const idB = await fetchIdentity(nodeB);
  await seedPeerOnVarde(idA);
  await seedPeerOnVarde(idB);
  console.log(`[smoke] seeded peer identities on Varde`);

  startMesh(nodeA);
  startMesh(nodeB);
  await waitForMesh(nodeA);
  await waitForMesh(nodeB);
  console.log(`[smoke] both mesh-svcs up`);

  // Give tunnels a moment to handshake.
  await wait(800);
  const statusA = await (
    await fetch(`http://localhost:${nodeA.meshPort}/publish/status`)
  ).json();
  const statusB = await (
    await fetch(`http://localhost:${nodeB.meshPort}/publish/status`)
  ).json();
  console.log(`[smoke] node A tunnels: ${JSON.stringify(statusA)}`);
  console.log(`[smoke] node B tunnels: ${JSON.stringify(statusB)}`);

  // Post an event on node A.
  const eventRes = await fetch(`http://localhost:${nodeA.corePort}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Mesh smoke event",
      description: "From Hafslund to Statkraft via Varde",
      severity: "high",
      source: "manual",
    }),
  });
  if (!eventRes.ok) {
    console.error(
      `[smoke] node A POST /events ${eventRes.status}: ${await eventRes.text()}`,
    );
    cleanup();
    process.exit(1);
  }
  const event = (await eventRes.json()) as { id: string };
  console.log(`[smoke] node A signed event id=${event.id}`);

  // Wait up to 3 seconds for node B to receive it.
  const deadline = Date.now() + 3000;
  let receivedOnB: { id: string } | undefined;
  while (Date.now() < deadline) {
    const list = (await (
      await fetch(`http://localhost:${nodeB.corePort}/events`)
    ).json()) as Array<{ id: string }>;
    receivedOnB = list.find((e) => e.id === event.id);
    if (receivedOnB) break;
    await wait(150);
  }

  if (receivedOnB) {
    console.log(`[smoke] ✅ node B received event id=${event.id} via mesh`);
    cleanup();
    process.exit(0);
  } else {
    console.error(`[smoke] ❌ node B did not receive event within deadline`);
    cleanup();
    process.exit(1);
  }
}

// ── helpers ──────────────────────────────────────────────────────────────

async function ensureDbs(): Promise<void> {
  // Use docker exec to create the two databases if they don't exist.
  for (const db of [nodeA.database, nodeB.database]) {
    await sh(
      `docker exec be-postgres-1 psql -U ${PG_USER} -d postgres -c "CREATE DATABASE ${db};" 2>&1 || true`,
    );
    await sh(
      `docker exec be-postgres-1 psql -U ${PG_USER} -d ${db} -c "TRUNCATE TABLE peers, events, indicators, chat_messages, revocations, varde_roster CASCADE;" 2>&1 || true`,
    );
  }
}

async function runMigrations(node: NodeStack): Promise<void> {
  const url = `postgres://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${node.database}`;
  const proc = spawn({
    cmd: ["bun", `${beRoot}/packages/db/src/migrate.ts`],
    env: { ...process.env, DATABASE_URL: url },
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;
  if (proc.exitCode !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`migration failed for ${node.name}: ${err}`);
  }
}

function startCore(node: NodeStack): void {
  const url = `postgres://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${node.database}`;
  node.coreProc = spawn({
    cmd: ["bun", `${beRoot}/services/core-svc/src/index.ts`],
    env: {
      ...process.env,
      DATABASE_URL: url,
      PORT: String(node.corePort),
      NODE_ID: node.nodeId,
      COMPANY: node.company,
      ROLE: "peer",
      MESH_SVC_URL: `http://localhost:${node.meshPort}`,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  pipeLogs(node.coreProc, `core-${node.name}`);
}

function startMesh(node: NodeStack): void {
  const url = `postgres://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${node.database}`;
  node.meshProc = spawn({
    cmd: ["bun", `${beRoot}/services/mesh-svc/src/index.ts`],
    env: {
      ...process.env,
      DATABASE_URL: url,
      PORT: String(node.meshPort),
      NODE_ID: node.nodeId,
      COMPANY: node.company,
      CORE_SVC_URL: `http://localhost:${node.corePort}`,
      VARDE_BOOTSTRAP: VARDE_WS,
      VARDE_TOP_N: "1",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  pipeLogs(node.meshProc, `mesh-${node.name}`);
}

async function waitForCore(node: NodeStack): Promise<void> {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://localhost:${node.corePort}/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await wait(200);
  }
  throw new Error(`core-${node.name} never started`);
}

async function waitForMesh(node: NodeStack): Promise<void> {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://localhost:${node.meshPort}/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await wait(200);
  }
  throw new Error(`mesh-${node.name} never started`);
}

async function fetchIdentity(node: NodeStack): Promise<{
  node_id: string;
  company: string;
  public_key: string;
}> {
  const peers = (await (
    await fetch(`http://localhost:${node.corePort}/peers`)
  ).json()) as Array<{
    node_id: string;
    company: string;
    public_key: string;
  }>;
  const me = peers.find((p) => p.node_id === node.nodeId);
  if (!me) throw new Error(`no self-identity in core-${node.name}`);
  return me;
}

async function seedPeerOnVarde(identity: {
  node_id: string;
  company: string;
  public_key: string;
}): Promise<void> {
  const res = await fetch(`${VARDE_HTTP}/test/upsert-peer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(identity),
  });
  if (!res.ok) {
    throw new Error(`varde /test/upsert-peer ${res.status}`);
  }
}

async function pipeLogs(
  proc: Subprocess,
  tag: string,
): Promise<void> {
  const decoder = new TextDecoder();
  if (proc.stdout) {
    const stream = proc.stdout as unknown as ReadableStream<Uint8Array>;
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      process.stdout.write(`[${tag}] ${decoder.decode(value)}`);
    }
  }
}

function cleanup(): void {
  for (const node of [nodeA, nodeB]) {
    node.coreProc?.kill();
    node.meshProc?.kill();
  }
}

async function sh(cmd: string): Promise<string> {
  const proc = spawn({
    cmd: ["sh", "-c", cmd],
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;
  return await new Response(proc.stdout).text();
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

await main();
