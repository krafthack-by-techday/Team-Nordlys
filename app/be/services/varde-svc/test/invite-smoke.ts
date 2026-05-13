#!/usr/bin/env bun
// Smoke-test for the INVITE_VALIDATION_FORWARD/RESPONSE flow.
//
// Setup:
//   1. Postgres + migrate
//   2. KraftCERT stack: core-svc (ROLE=kraftcert) + mesh-svc
//   3. varde-svc with KRAFTCERT_NODE_IDS=kraftcert-1
//
// Flow:
//   a. KraftCERT mesh-svc connects to Varde, gets WELCOME (its identity is
//      self-registered into core-svc at startup, then we seed it on the
//      Varde via /test/upsert-peer).
//   b. We mint an invite on KraftCERT core-svc (POST /invites).
//   c. We open a fresh WS to Varde with invite_token and an unknown
//      node_id. Varde parks it, forwards INVITE_VALIDATION_FORWARD to
//      KraftCERT, which calls /register and ships the signed identity
//      back. Varde completes the HELLO with WELCOME.
//   d. Assertion: the new node receives WELCOME (not REJECTED) within 2s.

import { spawn, type Subprocess } from "bun";
import { generateKeypair } from "@nordlys/crypto";
import { resolve } from "node:path";

const here = import.meta.dirname;
const beRoot = resolve(here, "..", "..", "..");
const VARDE_HTTP = "http://localhost:3020";
const VARDE_WS = "ws://localhost:3020/ws";

let postgresStarted = false;

async function main() {
  await sh(
    `docker compose -f ${beRoot}/docker-compose.dev.yml up -d postgres`,
  );
  postgresStarted = true;
  await sh(
    `until docker compose -f ${beRoot}/docker-compose.dev.yml ps postgres | grep -q "healthy"; do sleep 1; done`,
  );
  await sh(
    `docker exec be-postgres-1 psql -U nordlys -d nordlys -c "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP TABLE IF EXISTS events, indicators, chat_messages, peers, revocations, varde_roster, audit_log, invite_tokens, vulnerabilities, tools, scans, ingest_dedup CASCADE;"`,
  );
  await runMigrate();

  const dbUrl = "postgres://nordlys:nordlys@localhost:5432/nordlys";

  const kraftcertCore = spawnSvc("services/core-svc/src/index.ts", {
    DATABASE_URL: dbUrl,
    PORT: "4010",
    NODE_ID: "kraftcert-1",
    COMPANY: "KraftCERT",
    ROLE: "kraftcert",
    MESH_SVC_URL: "http://localhost:4011",
  });
  await waitFor("http://localhost:4010/health", "kraftcert-core");

  const varde = spawnSvc("services/varde-svc/src/index.ts", {
    DATABASE_URL: dbUrl,
    PORT: "3020",
    VARDE_ID: "varde-1",
    VARDE_TEST_MODE: "true",
    PUBLIC_URL: VARDE_HTTP,
    KRAFTCERT_NODE_IDS: "kraftcert-1",
  });
  await waitFor(`${VARDE_HTTP}/health`, "varde");

  // Pre-seed kraftcert identity on Varde so its HELLO is accepted.
  const kraftcertIdentity = (await fetch(
    "http://localhost:4010/peers",
  ).then((r) => r.json())) as Array<{
    node_id: string;
    company: string;
    public_key: string;
  }>;
  const me = kraftcertIdentity.find((p) => p.node_id === "kraftcert-1")!;
  await fetch(`${VARDE_HTTP}/test/upsert-peer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      node_id: me.node_id,
      company: me.company,
      public_key: me.public_key,
    }),
  });

  const kraftcertMesh = spawnSvc("services/mesh-svc/src/index.ts", {
    DATABASE_URL: dbUrl,
    PORT: "4011",
    NODE_ID: "kraftcert-1",
    COMPANY: "KraftCERT",
    CORE_SVC_URL: "http://localhost:4010",
    VARDE_BOOTSTRAP: VARDE_WS,
    VARDE_TOP_N: "1",
  });
  await waitFor("http://localhost:4011/health", "kraftcert-mesh");

  // Give the mesh tunnel time to handshake.
  await wait(800);

  // Mint an invite for a new candidate.
  const inviteRes = await fetch("http://localhost:4010/invites", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ company: "Glitrenett" }),
  });
  if (!inviteRes.ok) throw new Error(`invite mint ${inviteRes.status}`);
  const invite = (await inviteRes.json()) as { token: string };
  console.log(`[smoke] minted invite token=${invite.token.slice(0, 12)}...`);

  // Now connect a brand-new node to the Varde with the invite_token.
  const candidate = generateKeypair();
  const ws = new WebSocket(VARDE_WS);
  const messages: Array<{ type: string; reason?: string }> = [];
  await new Promise<void>((res, rej) => {
    ws.addEventListener("open", () => res());
    ws.addEventListener("error", (e) => rej(e));
  });
  ws.addEventListener("message", (ev) => {
    try {
      messages.push(JSON.parse(ev.data as string));
    } catch {
      // ignore non-JSON
    }
  });
  ws.send(
    JSON.stringify({
      type: "HELLO",
      seq: 1,
      node_id: "glitrenett-1",
      company: "Glitrenett",
      public_key: candidate.publicKey,
      invite_token: invite.token,
    }),
  );

  // Wait up to 3s for WELCOME.
  const deadline = Date.now() + 3000;
  let welcome: { type: string } | undefined;
  while (Date.now() < deadline) {
    welcome = messages.find((m) => m.type === "WELCOME");
    if (welcome) break;
    await wait(100);
  }

  if (welcome) {
    console.log(`[smoke] ✅ candidate received WELCOME via invite-flow`);
  } else {
    console.error(
      `[smoke] ❌ no WELCOME within deadline. messages: ${JSON.stringify(messages).slice(0, 400)}`,
    );
    cleanup([kraftcertMesh, varde, kraftcertCore]);
    process.exit(1);
  }

  ws.close();
  cleanup([kraftcertMesh, varde, kraftcertCore]);
  process.exit(0);
}

function spawnSvc(
  entry: string,
  env: Record<string, string>,
): Subprocess {
  const proc = spawn({
    cmd: ["bun", `${beRoot}/${entry}`],
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const tag = entry.split("/").slice(-2)[0];
  void pipeLogs(proc, tag ?? entry);
  return proc;
}

async function pipeLogs(proc: Subprocess, tag: string): Promise<void> {
  const decoder = new TextDecoder();
  if (!proc.stdout) return;
  const stream = proc.stdout as unknown as ReadableStream<Uint8Array>;
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    process.stdout.write(`[${tag}] ${decoder.decode(value)}`);
  }
}

async function waitFor(url: string, label: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await wait(200);
  }
  throw new Error(`${label} never started`);
}

async function runMigrate(): Promise<void> {
  const proc = spawn({
    cmd: ["bun", `${beRoot}/packages/db/src/migrate.ts`],
    env: {
      ...process.env,
      DATABASE_URL: "postgres://nordlys:nordlys@localhost:5432/nordlys",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;
  if (proc.exitCode !== 0) throw new Error("migration failed");
}

function cleanup(procs: Subprocess[]): void {
  for (const p of procs) p.kill();
  if (postgresStarted) {
    void sh(`docker compose -f ${beRoot}/docker-compose.dev.yml stop`);
  }
}

async function sh(cmd: string): Promise<void> {
  const proc = spawn({
    cmd: ["sh", "-c", cmd],
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

await main();
