import { Elysia } from "elysia";
import { signObject } from "@nordlys/crypto";
import type { SignedVardeRoster } from "@nordlys/contracts";
import { config } from "../config";
import { getVardeKeypair } from "../keystore";
import { getDbInstance } from "../db";
import { listVardeRoster } from "../repos";

// Bootstrap fallback per TBD-TRANSPORT: nodes hit this URL when they have
// been disconnected for >2 minutes and the cached roster is stale.
export const wellKnownRoutes = new Elysia().get(
  "/.well-known/stk-roster",
  async () => {
    const db = getDbInstance();
    const roster = await listVardeRoster(db);
    const { publicKey, privateKey } = getVardeKeypair();
    const generated_at = new Date().toISOString();

    const body: Omit<SignedVardeRoster, "signature"> = {
      varder: roster.length
        ? roster
        : [
            {
              varde_id: config.vardeId,
              url: config.publicUrl,
              public_key: publicKey,
              registered_at: generated_at,
            },
          ],
      generated_at,
      signed_by: config.vardeId,
    };
    const signature = signObject(body, privateKey);
    return { ...body, signature };
  },
);
