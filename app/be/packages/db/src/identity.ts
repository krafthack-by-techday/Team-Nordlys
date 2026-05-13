import { eq, inArray } from "drizzle-orm";
import { getDb } from "./client";
import * as schema from "./schema";

export type Role = "peer" | "kraftcert";

export class IdentityNotInitializedError extends Error {
  constructor(missing: string[]) {
    super(`node identity not initialized — missing: ${missing.join(", ")}. Run setup wizard.`);
    this.name = "IdentityNotInitializedError";
  }
}

export interface NodeIdentity {
  nodeId: string;
  company: string;
  role: Role;
}

async function readSettings(keys: string[]): Promise<Record<string, string>> {
  const { db } = getDb();
  const rows = await db
    .select({ key: schema.nodeSettings.key, value: schema.nodeSettings.value })
    .from(schema.nodeSettings)
    .where(inArray(schema.nodeSettings.key, keys));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function normalizeRole(value: string | undefined): Role {
  return value === "kraftcert" ? "kraftcert" : "peer";
}

/**
 * Resolve node identity. Env vars take precedence over DB-persisted setup values.
 * Returns null if NODE_ID or COMPANY cannot be resolved.
 */
export async function tryResolveIdentity(): Promise<NodeIdentity | null> {
  const envNodeId = process.env.NODE_ID;
  const envCompany = process.env.COMPANY;
  const envRole = process.env.ROLE;

  let nodeId = envNodeId;
  let company = envCompany;
  let role = envRole;

  if (!nodeId || !company || !role) {
    try {
      const settings = await readSettings(["node_id", "company", "role"]);
      nodeId ??= settings.node_id;
      company ??= settings.company;
      role ??= settings.role;
    } catch {
      // DB not reachable — caller decides whether that's fatal.
    }
  }

  if (!nodeId || !company) return null;
  return { nodeId, company, role: normalizeRole(role) };
}

/**
 * Resolve node identity or throw IdentityNotInitializedError. Use in services
 * that must not start without a real identity (e.g. mesh-svc, which would
 * otherwise sign outbound messages with a placeholder).
 */
export async function resolveIdentity(): Promise<NodeIdentity> {
  const id = await tryResolveIdentity();
  if (id) return id;
  const envNodeId = process.env.NODE_ID;
  const envCompany = process.env.COMPANY;
  const missing: string[] = [];
  if (!envNodeId) missing.push("NODE_ID");
  if (!envCompany) missing.push("COMPANY");
  throw new IdentityNotInitializedError(missing);
}

/**
 * Persist the node's role to node_settings. Called by the setup wizard
 * (default "peer") and by the KraftCERT self-activate flow ("kraftcert").
 */
export async function setRole(role: Role): Promise<void> {
  const { db } = getDb();
  await db
    .insert(schema.nodeSettings)
    .values({ key: "role", value: role })
    .onConflictDoUpdate({
      target: schema.nodeSettings.key,
      set: { value: role, updatedAt: new Date() },
    });
}
