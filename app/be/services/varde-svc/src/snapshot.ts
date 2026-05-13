import { signObject } from "@nordlys/crypto";
import type { SignedVardeRoster } from "@nordlys/contracts";
import type { StateSnapshotMsg } from "@nordlys/ws-protocol";
import { config } from "./config";
import { getVardeKeypair } from "./keystore";
import { getDbInstance } from "./db";
import {
  listIdentities,
  listRevocations,
  listVardeRoster,
} from "./repos";

// Builds a signed STATE_SNAPSHOT for new node bootstrap. Per the architecture
// note this avoids hundreds of round-trips at scale (400 nodes × identities)
// by shipping the whole identity register + Varde roster as one signed blob.
export async function buildSnapshot(): Promise<
  Omit<StateSnapshotMsg, "seq">
> {
  const db = getDbInstance();
  const [identities, revocations, vardeRoster] = await Promise.all([
    listIdentities(db),
    listRevocations(db),
    listVardeRoster(db),
  ]);

  const generated_at = new Date().toISOString();
  const { publicKey, privateKey } = getVardeKeypair();

  const roster: Omit<SignedVardeRoster, "signature"> = {
    varder: vardeRoster.length
      ? vardeRoster.map((v) => ({
          varde_id: v.varde_id,
          url: v.url,
          public_key: v.public_key,
          registered_at: v.registered_at,
        }))
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
  const rosterSignature = signObject(roster, privateKey);
  const signedRoster: SignedVardeRoster = {
    ...roster,
    signature: rosterSignature,
  };

  const body = {
    type: "STATE_SNAPSHOT" as const,
    identities,
    revocations,
    varde_roster: signedRoster,
    generated_at,
    signed_by: config.vardeId,
  };
  const signature = signObject(body, privateKey);
  return { ...body, signature };
}
