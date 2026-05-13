import { signObject } from "@nordlys/crypto";
import type { SignedPeerIdentity } from "@nordlys/contracts";
import { config, refreshIdentity } from "./config";
import { getKeypair } from "./keystore";
import { getDbInstance } from "./db";
import { upsertPeer } from "./repos/peers";
import { eq } from "drizzle-orm";
import { schema, getDb, setRole } from "@nordlys/db";

// On startup the node registers its own identity in the local peer table so
// inbound mesh traffic can verify its outbound signatures by looking up its
// own public key. KraftCERT-issued identities arrive later via gossip.
export async function selfRegister(): Promise<void> {
  if (!config.isInitialized) {
    console.warn(
      "[core-svc] node identity not initialized — skipping self-register until setup completes",
    );
    return;
  }
  const { publicKey } = getKeypair();
  const partial = {
    node_id: config.nodeId,
    company: config.company,
    public_key: publicKey,
    registered_at: new Date().toISOString(),
    registered_by: "self",
    signed_by: config.nodeId,
  };
  const signature = signObject(partial, getKeypair().privateKey);
  const identity: SignedPeerIdentity = { ...partial, signature };
  await upsertPeer(getDbInstance(), identity);
  console.log(
    `[core-svc] self-registered ${config.nodeId} (${config.company}, role=${config.role})`,
  );
}

/**
 * Re-read node_id/company from DB and re-register.
 * Called after setup wizard completes for KraftCERT nodes.
 */
export async function selfActivate(): Promise<{ node_id: string; role: string }> {
  // KraftCERT self-activate marks this node as the trust anchor.
  await setRole("kraftcert");
  await refreshIdentity();

  if (!config.isInitialized) {
    throw new Error("self-activate called but node identity is still missing in node_settings");
  }

  // Remove placeholder identity if it exists
  const { db } = getDb();
  await db.delete(schema.peers).where(eq(schema.peers.nodeId, "uninitialized")).catch(() => {});

  const { publicKey } = getKeypair();
  const partial = {
    node_id: config.nodeId,
    company: config.company,
    public_key: publicKey,
    registered_at: new Date().toISOString(),
    registered_by: "self",
    signed_by: config.nodeId,
  };
  const signature = signObject(partial, getKeypair().privateKey);
  const identity: SignedPeerIdentity = { ...partial, signature };
  await upsertPeer(getDbInstance(), identity);
  console.log(`[core-svc] self-activated ${config.nodeId} (${config.company}, role=${config.role})`);
  return { node_id: config.nodeId, role: config.role };
}
