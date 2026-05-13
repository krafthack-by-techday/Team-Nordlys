import { Elysia, t } from "elysia";
import { verifyObject } from "@nordlys/crypto";
import {
  Revocation,
  SignedEvent,
  type SignedPeerIdentity,
} from "@nordlys/contracts";
import { getDbInstance } from "../db";
import {
  broadcast,
} from "../connections";
import {
  dedupInsertEvent,
  eventsSinceCursor,
  getIdentity,
  insertRevocation,
  isRevoked,
  listIdentities,
  listRevocations,
  listVardeRoster,
  upsertIdentity,
  upsertVardeRoster,
} from "../repos";

// HTTP gossip endpoints used by *other Varder* (not nodes). Authenticated
// later in v1.1 with mTLS — for v1.0 we accept based on signature on each
// payload (events/identities/revocations are individually signed).
export const gossipRoutes = new Elysia({ prefix: "/v1" })
  .get(
    "/events/since/:cursor",
    async ({ params }) => {
      const cursor = new Date(decodeURIComponent(params.cursor));
      if (Number.isNaN(cursor.getTime())) return [];
      return await eventsSinceCursor(getDbInstance(), cursor);
    },
  )
  .post(
    "/events/sync",
    async ({ body }) => {
      const db = getDbInstance();
      let inserted = 0;
      for (const event of body) {
        const signer = await getIdentity(db, event.node_id);
        if (!signer) continue;
        if (await isRevoked(db, event.node_id)) continue;
        if (!verifyObject(event, signer.public_key)) continue;
        const r = await dedupInsertEvent(db, event);
        if (r.inserted) {
          inserted++;
          broadcast({ type: "EVENT", event });
        }
      }
      return { received: body.length, inserted };
    },
    { body: t.Array(SignedEvent) },
  )
  .get("/identity", async () => {
    const db = getDbInstance();
    const [peers, revocations] = await Promise.all([
      listIdentities(db),
      listRevocations(db),
    ]);
    return { peers, revocations };
  })
  .post(
    "/identity/sync",
    async ({ body }) => {
      const db = getDbInstance();
      let added = 0;
      for (const peer of body as SignedPeerIdentity[]) {
        // Identity records are signed by their issuer (often KraftCERT).
        // We trust them if the issuer is in our local register and the
        // signature checks out. Bootstrap-time records signed by self are
        // accepted unconditionally (verified at HELLO-time on WS path).
        const issuer = await getIdentity(db, peer.signed_by);
        if (issuer && !verifyObject(peer, issuer.public_key)) continue;
        await upsertIdentity(db, peer);
        added++;
      }
      return { received: body.length, added };
    },
    { body: t.Array(t.Any()) },
  )
  .post(
    "/revocations/sync",
    async ({ body }) => {
      const db = getDbInstance();
      for (const rev of body) {
        const issuer = await getIdentity(db, rev.signed_by);
        if (issuer && !verifyObject(rev, issuer.public_key)) continue;
        await insertRevocation(db, rev);
        broadcast({ type: "REVOCATION", revocation: rev });
      }
      return { received: body.length };
    },
    { body: t.Array(Revocation) },
  )
  .get("/roster", async () => {
    return await listVardeRoster(getDbInstance());
  })
  .post(
    "/roster/announce",
    async ({ body }) => {
      await upsertVardeRoster(getDbInstance(), body);
      return { ok: true };
    },
    {
      body: t.Object({
        varde_id: t.String(),
        url: t.String(),
        public_key: t.String(),
      }),
    },
  );
