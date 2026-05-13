import { Elysia, t } from "elysia";
import { signObject, verifyObject } from "@nordlys/crypto";
import {
  Company,
  InviteRedemption,
  AccessRequest,
  type Revocation,
  type SignedPeerIdentity,
} from "@nordlys/contracts";
import { config } from "../config";
import { getKeypair } from "../keystore";
import { getDbInstance } from "../db";
import {
  insertRevocation,
  listPeers,
  listRevocations,
  touchLastSeen,
  upsertPeer,
} from "../repos/peers";
import { consumeInvite, createInvite, listInvites } from "../repos/invites";

export const identityRoutes = new Elysia()
  .get("/peers", async () => {
    return await listPeers(getDbInstance());
  })
  .post(
    "/peers/:nodeId/heartbeat",
    async ({ params, set }) => {
      const ok = await touchLastSeen(getDbInstance(), params.nodeId);
      if (!ok) {
        set.status = 404;
        return { error: "peer_not_found" };
      }
      return { ok: true };
    },
    { params: t.Object({ nodeId: t.String() }) },
  )
  .get("/identities", async () => {
    return await listPeers(getDbInstance());
  })
  .get("/revocations", async () => {
    return await listRevocations(getDbInstance());
  })
  .post(
    "/invites",
    async ({ body, set }) => {
      if (config.role !== "kraftcert") {
        set.status = 403;
        return { error: "kraftcert_role_required" };
      }
      const created = await createInvite(getDbInstance(), body.company);
      set.status = 201;
      return {
        token: created.token,
        company: created.company,
        expires_at: created.expiresAt.toISOString(),
      };
    },
    { body: t.Object({ company: Company }) },
  )
  .get("/invites", async ({ set }) => {
    if (config.role !== "kraftcert") {
      set.status = 403;
      return { error: "kraftcert_role_required" };
    }
    return await listInvites(getDbInstance());
  })
  .post(
    "/register",
    async ({ body, set }) => {
      const db = getDbInstance();
      const consumed = await consumeInvite(db, body.token, body.node_id);
      if (!consumed) {
        set.status = 401;
        return { error: "invalid_or_expired_invite" };
      }
      if (consumed.company !== body.company) {
        set.status = 400;
        return { error: "company_mismatch" };
      }

      const identity: Omit<SignedPeerIdentity, "signature" | "signed_by"> = {
        node_id: body.node_id,
        company: body.company,
        public_key: body.public_key,
        registered_at: new Date().toISOString(),
        registered_by: config.nodeId,
      };
      const signature = signObject(
        { ...identity, signed_by: config.nodeId },
        getKeypair().privateKey,
      );
      const signed: SignedPeerIdentity = {
        ...identity,
        signed_by: config.nodeId,
        signature,
      };
      await upsertPeer(db, signed);
      set.status = 201;
      return signed;
    },
    { body: InviteRedemption },
  )
  .post(
    "/revoke",
    async ({ body, set }) => {
      if (config.role !== "kraftcert") {
        set.status = 403;
        return { error: "kraftcert_role_required" };
      }
      const partial: Omit<Revocation, "signature"> = {
        node_id: body.node_id,
        company: body.company,
        revoked_at: new Date().toISOString(),
        reason: body.reason ?? "",
        signed_by: config.nodeId,
      };
      const signature = signObject(partial, getKeypair().privateKey);
      const revocation: Revocation = { ...partial, signature };
      await insertRevocation(getDbInstance(), revocation);
      set.status = 201;
      return revocation;
    },
    {
      body: t.Object({
        node_id: t.String(),
        company: t.String(),
        reason: t.Optional(t.String()),
      }),
    },
  )
  /**
   * POST /access-requests/approve — KraftCERT approves an access request.
   * Verifies the signature, creates an invite token bound to the company.
   */
  .post(
    "/access-requests/approve",
    async ({ body, set }) => {
      if (config.role !== "kraftcert") {
        set.status = 403;
        return { error: "kraftcert_role_required" };
      }

      // Verify the access request signature against the embedded public key
      const { signature, ...payload } = body;
      const valid = verifyObject(
        { ...payload, signature },
        body.public_key,
      );
      if (!valid) {
        set.status = 400;
        return { error: "invalid_signature" };
      }

      // Create an invite token bound to the declared company
      const invite = await createInvite(getDbInstance(), body.company);

      set.status = 201;
      return {
        ok: true,
        node_id: body.node_id,
        company: body.company,
        invite: {
          token: invite.token,
          expires_at: invite.expiresAt.toISOString(),
        },
      };
    },
    {
      body: t.Object({
        node_id: t.String(),
        company: t.String(),
        public_key: t.String(),
        contact: t.Object({
          name: t.String(),
          email: t.String({ format: "email" }),
          phone: t.Optional(t.String()),
        }),
        requested_at: t.String(),
        signature: t.String(),
      }),
    },
  );
