import { Elysia, t } from "elysia";
import { verifyObject } from "@nordlys/crypto";
import { getDbInstance } from "../db";
import { getPeer, isRevoked } from "../repos/peers";

// mesh-svc calls this for every inbound EVENT/INDICATOR/CHAT before
// persisting to the local DB. It looks up the originator's public key,
// verifies the Ed25519 signature, and rejects revoked peers.
export const verifyRoutes = new Elysia().post(
  "/verify",
  async ({ body, set }) => {
    const db = getDbInstance();

    if (await isRevoked(db, body.signer_node_id)) {
      set.status = 200;
      return { ok: false, reason: "signer_revoked" };
    }

    const peer = await getPeer(db, body.signer_node_id);
    if (!peer) {
      set.status = 200;
      return { ok: false, reason: "unknown_signer" };
    }

    const ok = verifyObject(
      body.payload as { signature: string },
      peer.public_key,
    );
    return { ok, reason: ok ? null : "signature_mismatch" };
  },
  {
    body: t.Object({
      signer_node_id: t.String(),
      payload: t.Object({ signature: t.String() }, { additionalProperties: true }),
    }),
  },
);
