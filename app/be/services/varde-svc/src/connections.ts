import type { ServerMsg } from "@nordlys/ws-protocol";
import { wsSessions, wsMessagesTotal } from "./metrics";

// `Omit<T, K>` on a discriminated union collapses it; we need a distributive
// version so `Omit<ServerMsg, "seq">` keeps the per-variant shape intact.
type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

// Minimal subset of Bun's WebSocket interface — Elysia wraps the underlying
// socket, so a structural type avoids parameter-mismatch on `ws.raw` while
// still type-checking calls we make.
export interface RawWS {
  send(data: string | ArrayBufferView | ArrayBuffer): number | undefined;
  close(code?: number, reason?: string): void;
}

// In-memory tracker for active WS sessions. Keyed by node_id; restart of the
// Varde drops all connections (clients reconnect with backoff + jitter).
interface Session {
  nodeId: string;
  company: string;
  ws: RawWS;
  outboundSeq: number;
  helloAt: number;
  lastPingAt: number;
  eventsLastMinute: number[];
}

const sessions = new Map<string, Session>();

export function registerSession(
  nodeId: string,
  company: string,
  ws: RawWS,
): void {
  const existing = sessions.get(nodeId);
  if (existing) {
    try {
      existing.ws.close(1000, "replaced_by_new_session");
    } catch {
      // ignore — old socket may already be dead
    }
  }
  sessions.set(nodeId, {
    nodeId,
    company,
    ws,
    outboundSeq: 0,
    helloAt: Date.now(),
    lastPingAt: Date.now(),
    eventsLastMinute: [],
  });
  wsSessions.set(sessions.size);
}

export function unregisterSession(ws: RawWS): void {
  for (const [nodeId, session] of sessions) {
    if (session.ws === ws) {
      sessions.delete(nodeId);
      wsSessions.set(sessions.size);
      return;
    }
  }
}

export function findSessionByWs(
  ws: RawWS,
): Session | undefined {
  for (const session of sessions.values()) {
    if (session.ws === ws) return session;
  }
  return undefined;
}

export function getSession(nodeId: string): Session | undefined {
  return sessions.get(nodeId);
}

export function listSessions(): readonly Session[] {
  return [...sessions.values()];
}

// First-match lookup: returns the first connected session whose node_id is
// in the configured KraftCERT roster. Used to forward invite validation.
export function findKraftcertSession(
  kraftcertNodeIds: readonly string[],
): Session | undefined {
  for (const id of kraftcertNodeIds) {
    const s = sessions.get(id);
    if (s) return s;
  }
  return undefined;
}

type ServerMsgWithoutSeq = DistributiveOmit<ServerMsg, "seq">;

export function send(session: Session, msg: ServerMsgWithoutSeq): void {
  session.outboundSeq++;
  const full = { ...msg, seq: session.outboundSeq } as ServerMsg;
  try {
    session.ws.send(JSON.stringify(full));
    wsMessagesTotal.inc({ type: msg.type, direction: "out" });
  } catch (err) {
    console.warn(`[varde-svc] send to ${session.nodeId} failed:`, err);
  }
}

export function broadcast(
  msg: ServerMsgWithoutSeq,
  exclude?: string,
): void {
  for (const s of sessions.values()) {
    if (s.nodeId === exclude) continue;
    send(s, msg);
  }
}

export function recordEventFromNode(
  nodeId: string,
  capPerMinute: number,
): boolean {
  const session = sessions.get(nodeId);
  if (!session) return false;
  const now = Date.now();
  session.eventsLastMinute = session.eventsLastMinute.filter(
    (t) => now - t < 60_000,
  );
  if (session.eventsLastMinute.length >= capPerMinute) return false;
  session.eventsLastMinute.push(now);
  return true;
}

// Closes sessions that haven't pinged within the timeout. Called by the
// health-check loop; clients reconnect with backoff so this only frees
// dead tunnels.
export function reapIdleSessions(idleTimeoutMs: number): number {
  const cutoff = Date.now() - idleTimeoutMs;
  let reaped = 0;
  for (const [nodeId, session] of sessions) {
    if (session.lastPingAt < cutoff) {
      try {
        session.ws.close(1001, "idle_timeout");
      } catch {
        // socket may already be dead — drop the session anyway
      }
      sessions.delete(nodeId);
      reaped++;
    }
  }
  if (reaped > 0) wsSessions.set(sessions.size);
  return reaped;
}
