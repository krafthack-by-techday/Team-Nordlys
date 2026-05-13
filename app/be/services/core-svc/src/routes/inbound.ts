import { Elysia, t } from "elysia";
import { verifyObject } from "@nordlys/crypto";
import {
  Revocation,
  SignedChatMessage,
  SignedEvent,
  SignedIndicator,
  type SignedPeerIdentity,
} from "@nordlys/contracts";
import { getDbInstance } from "../db";
import { insertEvent } from "../repos/events";
import { insertIndicator } from "../repos/indicators";
import { insertChat } from "../repos/chat";
import {
  getPeer,
  insertRevocation,
  isRevoked,
  touchLastSeen,
  upsertPeer,
} from "../repos/peers";
import { redisPublishEvent } from "../redis-publish";

// Endpoints called by mesh-svc when objects arrive over the Varde-mesh.
// All payloads have already been signed by their originator on another node;
// we re-verify here as the trust boundary into our own DB.
export const inboundRoutes = new Elysia({ prefix: "/inbound" })
  .post(
    "/events",
    async ({ body, set }) => {
      const db = getDbInstance();
      // Extract path (transport metadata, not part of signed payload)
      const { path, ...eventBody } = body as Record<string, unknown> & { path?: string[] };
      const event = eventBody as unknown as typeof body;
      const signer = await getPeer(db, event.node_id);
      if (!signer) {
        set.status = 400;
        return { ok: false, reason: "unknown_signer" };
      }
      if (await isRevoked(db, event.node_id)) {
        set.status = 400;
        return { ok: false, reason: "signer_revoked" };
      }
      if (!verifyObject(event, signer.public_key)) {
        set.status = 400;
        return { ok: false, reason: "signature_mismatch" };
      }
      await insertEvent(db, event);
      await touchLastSeen(db, event.node_id);
      // Publish to SSE with relay path
      void redisPublishEvent({ ...event, path });
      set.status = 201;
      return { ok: true, id: event.id };
    },
    { body: SignedEvent },
  )
  .post(
    "/indicators",
    async ({ body, set }) => {
      const db = getDbInstance();
      const signer = await getPeer(db, body.node_id);
      if (!signer) {
        set.status = 400;
        return { ok: false, reason: "unknown_signer" };
      }
      if (await isRevoked(db, body.node_id)) {
        set.status = 400;
        return { ok: false, reason: "signer_revoked" };
      }
      if (!verifyObject(body, signer.public_key)) {
        set.status = 400;
        return { ok: false, reason: "signature_mismatch" };
      }
      await insertIndicator(db, body);
      await touchLastSeen(db, body.node_id);
      set.status = 201;
      return { ok: true, id: body.id };
    },
    { body: SignedIndicator },
  )
  .post(
    "/chat",
    async ({ body, set }) => {
      const db = getDbInstance();
      const signer = await getPeer(db, body.node_id);
      if (!signer) {
        set.status = 400;
        return { ok: false, reason: "unknown_signer" };
      }
      if (await isRevoked(db, body.node_id)) {
        set.status = 400;
        return { ok: false, reason: "signer_revoked" };
      }
      if (!verifyObject(body, signer.public_key)) {
        set.status = 400;
        return { ok: false, reason: "signature_mismatch" };
      }
      await insertChat(db, body);
      await touchLastSeen(db, body.node_id);
      set.status = 201;
      return { ok: true, id: body.id };
    },
    { body: SignedChatMessage },
  )
  .post(
    "/identity",
    async ({ body, set }) => {
      // Identity records are signed by their issuer (e.g. KraftCERT) — we
      // accept on issuer-signature when the issuer is in our local register,
      // otherwise accept self-signed (bootstrap).
      const db = getDbInstance();
      const peer = body as SignedPeerIdentity;
      if (peer.signed_by !== peer.node_id) {
        const issuer = await getPeer(db, peer.signed_by);
        if (issuer && !verifyObject(peer, issuer.public_key)) {
          set.status = 400;
          return { ok: false, reason: "issuer_signature_mismatch" };
        }
      }
      await upsertPeer(db, peer);
      set.status = 201;
      return { ok: true, node_id: peer.node_id };
    },
    { body: t.Any() },
  )
  .post(
    "/revocation",
    async ({ body, set }) => {
      const db = getDbInstance();
      const issuer = await getPeer(db, body.signed_by);
      if (issuer && !verifyObject(body, issuer.public_key)) {
        set.status = 400;
        return { ok: false, reason: "issuer_signature_mismatch" };
      }
      await insertRevocation(db, body);
      set.status = 201;
      return { ok: true, node_id: body.node_id };
    },
    { body: Revocation },
  );

// Cursor endpoint used by mesh-svc on RESYNC to know where to ask varde-svc
// to start replaying from.
export const cursorRoutes = new Elysia().get(
  "/last-event-cursor",
  async () => {
    const db = getDbInstance();
    const { schema } = await import("@nordlys/db");
    const { desc } = await import("drizzle-orm");
    const [row] = await db
      .select({ createdAt: schema.events.createdAt })
      .from(schema.events)
      .orderBy(desc(schema.events.createdAt))
      .limit(1);
    return { cursor: row?.createdAt.toISOString() ?? new Date(0).toISOString() };
  },
);
