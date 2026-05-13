import { Elysia, t } from "elysia";
import type { SignedPeerIdentity } from "@nordlys/contracts";
import { config } from "../config";
import { getDbInstance } from "../db";
import { upsertIdentity } from "../repos";

// Only mounted when VARDE_TEST_MODE=true. Allows smoke tests to seed peer
// identities without going through the full KraftCERT invite flow.
export const testingRoutes = new Elysia({ prefix: "/test" }).post(
  "/upsert-peer",
  async ({ body, set }) => {
    if (!process.env.VARDE_TEST_MODE) {
      set.status = 404;
      return { error: "not_found" };
    }
    const identity: SignedPeerIdentity = {
      node_id: body.node_id,
      company: body.company,
      public_key: body.public_key,
      registered_at: new Date().toISOString(),
      registered_by: "test",
      signed_by: config.vardeId,
      signature: "test-mode-no-signature",
    };
    await upsertIdentity(getDbInstance(), identity);
    set.status = 201;
    return identity;
  },
  {
    body: t.Object({
      node_id: t.String(),
      company: t.String(),
      public_key: t.String(),
    }),
  },
);
