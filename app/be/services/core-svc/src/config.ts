import { tryResolveIdentity, type Role } from "@nordlys/db";

export type { Role };

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const PLACEHOLDER = "uninitialized";

// Mutable identity slot. core-svc may boot before the setup wizard has run,
// so we tolerate a placeholder identity here (only the setup endpoints work
// until selfActivate is called). Use refreshIdentity() after setup to update.
let identity = await tryResolveIdentity();

export async function refreshIdentity(): Promise<void> {
  identity = await tryResolveIdentity();
}

export const config = {
  port: Number(process.env.PORT ?? 3010),
  databaseUrl: requiredEnv("DATABASE_URL"),
  get nodeId(): string {
    return identity?.nodeId ?? PLACEHOLDER;
  },
  get company(): string {
    return identity?.company ?? PLACEHOLDER;
  },
  get role(): Role {
    return identity?.role ?? "peer";
  },
  get isInitialized(): boolean {
    return identity !== null;
  },

  // Optional Ed25519 keypair via env. If absent, keystore reads from filesystem
  // or generates an ephemeral keypair (dev only).
  publicKey: process.env.NODE_PUBLIC_KEY,
  privateKey: process.env.NODE_PRIVATE_KEY,

  // Per-severity rate caps (events per hour). Enforced by core-svc before
  // an event is accepted from collector-svc.
  scenarioRateCaps: {
    low: Number(process.env.RATE_CAP_LOW ?? 20),
    medium: Number(process.env.RATE_CAP_MEDIUM ?? 10),
    high: Number(process.env.RATE_CAP_HIGH ?? 5),
    critical: Number(process.env.RATE_CAP_CRITICAL ?? 2),
  },

  // Optional URL of mesh-svc — when set, signed objects are pushed there
  // for fan-out across the Varde-mesh.
  meshSvcUrl: process.env.MESH_SVC_URL ?? "",
};

if (!identity) {
  console.warn(
    "[core-svc] node identity not initialized — placeholder in use until setup wizard completes",
  );
}
