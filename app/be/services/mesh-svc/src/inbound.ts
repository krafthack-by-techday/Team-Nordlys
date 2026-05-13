import type { ServerMsg } from "@nordlys/ws-protocol";
import { config } from "./config";
import { healthTracker } from "./health";
import { upsertVardeIntoRoster } from "./roster";
import type { Tunnel } from "./tunnel";

// Forward verified mesh objects to core-svc, which is the single writer to
// the local DB. core-svc re-verifies the signature as the trust boundary.

async function postInbound(path: string, body: unknown): Promise<void> {
  try {
    const res = await fetch(`${config.coreSvcUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        `[mesh-svc] core-svc ${path} ${res.status}: ${text.slice(0, 200)}`,
      );
    }
  } catch (err) {
    console.warn(`[mesh-svc] core-svc ${path} request failed:`, err);
  }
}

// Replay-detection per (varde-tunnel, channel) by remembering last-seen seq.
// In-memory is fine — duplicate UUIDs are deduped at core-svc anyway, this
// is just an early-drop optimisation for misbehaving Varder.
const seenSeq = new Map<string, number>();

function isReplay(tunnelKey: string, seq: number): boolean {
  const last = seenSeq.get(tunnelKey) ?? -1;
  if (seq <= last) return true;
  seenSeq.set(tunnelKey, seq);
  return false;
}

export async function handleServerMsg(
  tunnel: Tunnel,
  msg: ServerMsg,
): Promise<void> {
  const tunnelKey = tunnel.key;
  if (isReplay(tunnelKey, msg.seq)) {
    console.warn(
      `[mesh-svc] replay-drop on ${tunnelKey}: seq=${msg.seq}, type=${msg.type}`,
    );
    return;
  }

  switch (msg.type) {
    case "WELCOME":
      console.log(
        `[mesh-svc] WELCOME on ${tunnelKey} since=${msg.since_cursor}`,
      );
      // Always RESYNC after WELCOME — picks up anything missed during the
      // disconnect window. Idempotent: dedup at core-svc handles duplicates.
      void tunnel.sendResync();
      return;

    case "REJECTED":
      console.warn(`[mesh-svc] REJECTED on ${tunnelKey}: ${msg.reason}`);
      return;

    case "PONG":
      // Feed RTT measurement to health tracker
      tunnel.handlePong(msg.seq);
      return;

    case "EVENT": {
      // Measure delivery latency and feed to health tracker
      if (msg.event.created_at) {
        const latency = Date.now() - Date.parse(msg.event.created_at);
        if (latency > 0 && latency < 600_000) {
          healthTracker.recordDeliveryLatency(tunnel.varde.varde_id, latency);
        }
      }
      await postInbound("/inbound/events", { ...msg.event, path: msg.path });
      return;
    }

    case "INDICATOR":
      await postInbound("/inbound/indicators", msg.indicator);
      return;

    case "CHAT":
      await postInbound("/inbound/chat", msg.chat);
      return;

    case "IDENTITY_UPDATE":
      await postInbound("/inbound/identity", msg.identity);
      return;

    case "REVOCATION":
      await postInbound("/inbound/revocation", msg.revocation);
      return;

    case "VARDE_ROSTER": {
      const { varder } = msg.roster;
      for (const v of varder) {
        await upsertVardeIntoRoster({
          varde_id: v.varde_id,
          url: v.url,
          public_key: v.public_key,
        });
      }
      console.log(
        `[mesh-svc] VARDE_ROSTER on ${tunnelKey}: ${varder.length} entries`,
      );
      return;
    }

    case "INVITE_VALIDATION_FORWARD": {
      // We're tagged as a KraftCERT-role node and the Varde is asking us to
      // validate a candidate's invite_token. core-svc /register consumes the
      // token, signs the new identity, and persists it locally; we ship the
      // signed identity back to the Varde over the same tunnel.
      try {
        const res = await fetch(`${config.coreSvcUrl}/register`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            token: msg.invite_token,
            node_id: msg.candidate_node_id,
            company: msg.candidate_company,
            public_key: msg.candidate_public_key,
          }),
        });
        if (!res.ok) {
          const reason =
            res.status === 401
              ? "invalid_or_expired_invite"
              : `core_register_${res.status}`;
          tunnel.send({
            type: "INVITE_VALIDATION_RESPONSE",
            ...(msg.corr_id ? { corr_id: msg.corr_id } : {}),
            accepted: false,
            reason,
          });
          return;
        }
        const identity = (await res.json()) as Record<string, unknown>;
        tunnel.send({
          type: "INVITE_VALIDATION_RESPONSE",
          ...(msg.corr_id ? { corr_id: msg.corr_id } : {}),
          accepted: true,
          identity,
        });
        console.log(
          `[mesh-svc] approved invite for ${msg.candidate_node_id} (${msg.candidate_company})`,
        );
      } catch (err) {
        console.warn(`[mesh-svc] invite-validation forward failed:`, err);
        tunnel.send({
          type: "INVITE_VALIDATION_RESPONSE",
          ...(msg.corr_id ? { corr_id: msg.corr_id } : {}),
          accepted: false,
          reason: "core_unreachable",
        });
      }
      return;
    }

    case "STATE_SNAPSHOT": {
      // Snapshot signature is verified by mesh-svc against the issuing Varde
      // public key once we have it; for v1.0 skeleton we trust the in-band
      // contents and let core-svc re-verify each identity individually.
      for (const identity of msg.identities) {
        await postInbound("/inbound/identity", identity);
      }
      for (const rev of msg.revocations) {
        await postInbound("/inbound/revocation", rev);
      }
      for (const v of msg.varde_roster.varder) {
        await upsertVardeIntoRoster({
          varde_id: v.varde_id,
          url: v.url,
          public_key: v.public_key,
        });
      }
      console.log(
        `[mesh-svc] STATE_SNAPSHOT on ${tunnelKey}: ${msg.identities.length} identities, ${msg.revocations.length} revocations, ${msg.varde_roster.varder.length} varder`,
      );
      return;
    }
  }
}
