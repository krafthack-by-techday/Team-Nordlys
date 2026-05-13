import { verifyObject } from "@nordlys/crypto";
import type { ClientMsg } from "@nordlys/ws-protocol";
import type { RawWS } from "./connections";
import { config } from "./config";
import { getDbInstance } from "./db";
import { wsMessagesTotal } from "./metrics";
import {
  broadcast,
  findKraftcertSession,
  findSessionByWs,
  getSession,
  recordEventFromNode,
  registerSession,
  send,
} from "./connections";
import {
  dedupInsertChat,
  dedupInsertEvent,
  dedupInsertIndicator,
  eventsSinceCursor,
  getIdentity,
  isRevoked,
  upsertIdentity,
} from "./repos";
import { buildSnapshot } from "./snapshot";
import type { SignedPeerIdentity } from "@nordlys/contracts";
import { parkInvite, takePending } from "./pending-invites";

export async function handleClientMsg(
  ws: RawWS,
  raw: unknown,
): Promise<void> {
  let msg: ClientMsg;
  try {
    if (typeof raw === "string") {
      msg = JSON.parse(raw);
    } else if (raw && typeof raw === "object" && raw instanceof Uint8Array) {
      msg = JSON.parse(new TextDecoder().decode(raw));
    } else if (raw && typeof raw === "object") {
      // Elysia validates incoming WS frames against the declared body schema
      // and may hand us the already-parsed object. Accept it as-is.
      msg = raw as ClientMsg;
    } else {
      throw new Error(`unexpected ws frame type: ${typeof raw}`);
    }
  } catch (err) {
    console.warn(`[varde-svc] invalid frame:`, err, "raw type:", typeof raw);
    ws.send(
      JSON.stringify({
        type: "REJECTED",
        seq: 0,
        reason: "invalid_json",
      }),
    );
    return;
  }

  // Track every inbound message by type.
  wsMessagesTotal.inc({ type: msg.type, direction: "in" });

  switch (msg.type) {
    case "HELLO":
      await handleHello(ws, msg);
      return;
    case "PING":
      await handlePing(ws, msg);
      return;
    case "EVENT":
      await handleEvent(ws, msg);
      return;
    case "INDICATOR":
      await handleIndicator(ws, msg);
      return;
    case "CHAT":
      await handleChat(ws, msg);
      return;
    case "RESYNC":
      await handleResync(ws, msg);
      return;
    case "INVITE_VALIDATION_REQUEST":
      // Reserved for a future direct request flow from a node that wants
      // to ask the Varde to start validation outside the HELLO path.
      // The HELLO+invite_token path covers v1.0 onboarding.
      ws.send(
        JSON.stringify({
          type: "REJECTED",
          seq: 0,
          corr_id: msg.corr_id,
          reason: "use_hello_with_invite_token",
        }),
      );
      return;
    case "INVITE_VALIDATION_RESPONSE":
      await handleInviteValidationResponse(ws, msg);
      return;
  }
}

async function handleHello(
  ws: RawWS,
  msg: Extract<ClientMsg, { type: "HELLO" }>,
): Promise<void> {
  const db = getDbInstance();

  if (await isRevoked(db, msg.node_id)) {
    ws.send(
      JSON.stringify({
        type: "REJECTED",
        seq: 0,
        corr_id: msg.corr_id,
        reason: "node_revoked",
      }),
    );
    ws.close(1008, "revoked");
    return;
  }

  const known = await getIdentity(db, msg.node_id);
  if (!known) {
    // Unknown node — accept only if accompanied by an invite_token. We park
    // the connection, forward INVITE_VALIDATION_FORWARD to a KraftCERT
    // session, and complete on RESPONSE (or REJECTED on TTL expiry).
    if (!msg.invite_token) {
      ws.send(
        JSON.stringify({
          type: "REJECTED",
          seq: 0,
          corr_id: msg.corr_id,
          reason: "unknown_node_no_invite",
        }),
      );
      ws.close(1008, "unknown");
      return;
    }

    const kraftcert = findKraftcertSession(config.kraftcertNodeIds);
    if (!kraftcert) {
      ws.send(
        JSON.stringify({
          type: "REJECTED",
          seq: 0,
          corr_id: msg.corr_id,
          reason: "kraftcert_offline_retry_later",
        }),
      );
      ws.close(1013, "kraftcert_offline");
      return;
    }

    const pending = parkInvite({
      candidateWs: ws,
      candidateNodeId: msg.node_id,
      candidateCompany: msg.company,
      candidatePublicKey: msg.public_key,
      inviteToken: msg.invite_token,
      onTimeout: (entry) => {
        try {
          entry.candidateWs.send(
            JSON.stringify({
              type: "REJECTED",
              seq: 0,
              reason: "invite_validation_timeout",
            }),
          );
          entry.candidateWs.close(1008, "invite_timeout");
        } catch {
          // candidate may have already disconnected
        }
      },
    });

    send(kraftcert, {
      type: "INVITE_VALIDATION_FORWARD",
      corr_id: pending.corrId,
      invite_token: msg.invite_token,
      candidate_node_id: msg.node_id,
      candidate_company: msg.company,
      candidate_public_key: msg.public_key,
    });

    console.log(
      `[varde-svc] parked HELLO ${msg.node_id} corr_id=${pending.corrId}, forwarded to ${kraftcert.nodeId}`,
    );
    return;
  } else if (known.public_key !== msg.public_key) {
    ws.send(
      JSON.stringify({
        type: "REJECTED",
        seq: 0,
        corr_id: msg.corr_id,
        reason: "public_key_mismatch",
      }),
    );
    ws.close(1008, "key_mismatch");
    return;
  }

  registerSession(msg.node_id, msg.company, ws);

  const session = findSessionByWs(ws)!;
  send(session, {
    type: "WELCOME",
    accepted: true,
    since_cursor: msg.last_event_cursor ?? new Date(0).toISOString(),
    ...(msg.corr_id ? { corr_id: msg.corr_id } : {}),
  });

  // Send STATE_SNAPSHOT as separate frame for bootstrap.
  const snapshot = await buildSnapshot();
  send(session, snapshot);

  console.log(`[varde-svc] HELLO accepted: ${msg.node_id} (${msg.company})`);
}

async function handleInviteValidationResponse(
  _ws: RawWS,
  msg: Extract<ClientMsg, { type: "INVITE_VALIDATION_RESPONSE" }>,
): Promise<void> {
  if (!msg.corr_id) return;
  const pending = takePending(msg.corr_id);
  if (!pending) {
    // Unknown corr_id — likely a TTL-expired entry. Drop silently.
    return;
  }

  if (!msg.accepted || !msg.identity) {
    pending.candidateWs.send(
      JSON.stringify({
        type: "REJECTED",
        seq: 0,
        reason: msg.reason ?? "invite_rejected",
      }),
    );
    pending.candidateWs.close(1008, "invite_rejected");
    return;
  }

  const identity = msg.identity as SignedPeerIdentity;
  await upsertIdentity(getDbInstance(), identity);

  // Now that the candidate is known, run the normal HELLO completion path:
  // register session, send WELCOME + STATE_SNAPSHOT, fan out IDENTITY_UPDATE
  // so other connected nodes learn about the new peer immediately.
  registerSession(pending.candidateNodeId, pending.candidateCompany, pending.candidateWs);
  const session = findSessionByWs(pending.candidateWs);
  if (!session) return;
  send(session, {
    type: "WELCOME",
    accepted: true,
    since_cursor: new Date(0).toISOString(),
  });
  const snapshot = await buildSnapshot();
  send(session, snapshot);

  broadcast(
    { type: "IDENTITY_UPDATE", identity },
    pending.candidateNodeId,
  );

  console.log(
    `[varde-svc] invite-validation OK: ${pending.candidateNodeId} (${pending.candidateCompany})`,
  );
}

async function handlePing(
  ws: RawWS,
  msg: Extract<ClientMsg, { type: "PING" }>,
): Promise<void> {
  const session = findSessionByWs(ws);
  if (!session) return;
  session.lastPingAt = Date.now();
  send(session, { type: "PONG", seq_echo: msg.seq });
}

async function handleEvent(
  ws: RawWS,
  msg: Extract<ClientMsg, { type: "EVENT" }>,
): Promise<void> {
  const session = findSessionByWs(ws);
  if (!session) return rejectUnauthenticated(ws);

  const event = msg.event;

  // Per-node rate cap: drop silently above the cap (sender will see disconnect
  // if it persists; we also log so operators notice misbehaving nodes).
  if (!recordEventFromNode(session.nodeId, config.maxEventsPerNodePerMin)) {
    console.warn(
      `[varde-svc] rate cap hit for ${session.nodeId}; dropping event ${event.id}`,
    );
    return;
  }

  const db = getDbInstance();
  const signer = await getIdentity(db, event.node_id);
  if (!signer) {
    console.warn(`[varde-svc] event ${event.id} from unknown signer ${event.node_id}`);
    return;
  }
  if (await isRevoked(db, event.node_id)) {
    console.warn(`[varde-svc] event ${event.id} from revoked signer ${event.node_id}`);
    return;
  }
  if (!verifyObject(event, signer.public_key)) {
    console.warn(`[varde-svc] event ${event.id} signature mismatch`);
    return;
  }

  const { inserted } = await dedupInsertEvent(db, event);
  if (!inserted) return; // duplicate — already gossiped

  // Build relay path: origin → this varde
  const path = [...(msg.path ?? [event.node_id]), config.vardeId];

  // Fan-out to other connected nodes, excluding the originator's session.
  // Recipient list (selective distribution) is honored: empty/null means all.
  const recipients = event.recipients ?? null;
  if (recipients && recipients.length > 0) {
    for (const r of recipients) {
      const target = getSession(r);
      if (target) send(target, { type: "EVENT", event, path });
    }
  } else {
    broadcast({ type: "EVENT", event, path }, session.nodeId);
  }
}

async function handleIndicator(
  ws: RawWS,
  msg: Extract<ClientMsg, { type: "INDICATOR" }>,
): Promise<void> {
  const session = findSessionByWs(ws);
  if (!session) return rejectUnauthenticated(ws);

  const indicator = msg.indicator;
  const db = getDbInstance();
  const signer = await getIdentity(db, indicator.node_id);
  if (!signer) return;
  if (await isRevoked(db, indicator.node_id)) return;
  if (!verifyObject(indicator, signer.public_key)) return;

  const { inserted } = await dedupInsertIndicator(db, indicator);
  if (!inserted) return;

  broadcast({ type: "INDICATOR", indicator }, session.nodeId);
}

async function handleChat(
  ws: RawWS,
  msg: Extract<ClientMsg, { type: "CHAT" }>,
): Promise<void> {
  const session = findSessionByWs(ws);
  if (!session) return rejectUnauthenticated(ws);

  const chat = msg.chat;
  const db = getDbInstance();
  const signer = await getIdentity(db, chat.node_id);
  if (!signer) return;
  if (await isRevoked(db, chat.node_id)) return;
  if (!verifyObject(chat, signer.public_key)) return;

  const { inserted } = await dedupInsertChat(db, chat);
  if (!inserted) return;

  broadcast({ type: "CHAT", chat }, session.nodeId);
}

async function handleResync(
  ws: RawWS,
  msg: Extract<ClientMsg, { type: "RESYNC" }>,
): Promise<void> {
  const session = findSessionByWs(ws);
  if (!session) return rejectUnauthenticated(ws);

  const cursor = new Date(msg.from_cursor);
  if (msg.channels.includes("events")) {
    const events = await eventsSinceCursor(getDbInstance(), cursor);
    for (const event of events) {
      send(session, { type: "EVENT", event });
    }
  }
  // Indicators and chat resync follow the same shape — extracted to a helper
  // when the second channel needs identical pagination logic.
}

function rejectUnauthenticated(ws: RawWS): void {
  ws.send(
    JSON.stringify({
      type: "REJECTED",
      seq: 0,
      reason: "send_hello_first",
    }),
  );
  ws.close(1008, "unauthenticated");
}

export { unregisterSession } from "./connections";
