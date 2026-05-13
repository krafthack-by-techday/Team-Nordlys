import { Elysia } from "elysia";
import { eq, gt } from "drizzle-orm";
import { schema, getDb } from "@nordlys/db";
import { config } from "./config";

// ── Actor types ────────────────────────────────────────────────────────────

export type Actor =
  | { kind: "session"; userId: string; email: string; name: string; role: string }
  | { kind: "api-key"; name: string }
  | { kind: "anonymous" };

// ── Helpers ────────────────────────────────────────────────────────────────

const SESSION_COOKIE = "__Host-session";

function hashToken(token: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(token);
  return hasher.digest("hex");
}

async function resolveSession(cookie: string | undefined): Promise<Actor | null> {
  if (!cookie) return null;
  const tokenHash = hashToken(cookie);
  const { db } = getDb();
  const rows = await db
    .select({
      userId: schema.sessions.userId,
      expiresAt: schema.sessions.expiresAt,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(eq(schema.sessions.tokenHash, tokenHash))
    .limit(1);

  const row = rows[0];
  if (!row || row.expiresAt < new Date()) return null;
  return { kind: "session", userId: row.userId, email: row.email, name: row.name, role: row.role };
}

// ── Auth macros ────────────────────────────────────────────────────────────

export const authMacro = new Elysia({ name: "auth" }).macro({
  /**
   * Requires a valid session cookie. Returns 401 if not authenticated.
   */
  requireSession: {
    resolve({ cookie, set }) {
      return (async () => {
        const token = (cookie as Record<string, { value: string }>)?.[SESSION_COOKIE]?.value;
        const actor = await resolveSession(token);
        if (!actor) {
          set.status = 401;
          throw new Error("unauthenticated");
        }
        return { actor };
      })();
    },
  },

  /**
   * Requires a Bearer API-key (for machine-to-machine like SIEM ingest).
   */
  requireApiKey: {
    resolve({ headers, set }) {
      const header = headers.authorization ?? "";
      const match = /^Bearer\s+(.+)$/i.exec(header);
      const secret = match?.[1];
      const name = secret ? config.apiKeys.get(secret) : undefined;
      if (!name) {
        set.status = 401;
        throw new Error("invalid_api_key");
      }
      return { actor: { kind: "api-key" as const, name } };
    },
  },

  /**
   * Tries session first, then API key, falls back to anonymous.
   */
  optionalAuth: {
    resolve({ cookie, headers }) {
      return (async () => {
        // Try session
        const token = (cookie as Record<string, { value: string }>)?.[SESSION_COOKIE]?.value;
        const sessionActor = await resolveSession(token);
        if (sessionActor) return { actor: sessionActor };

        // Try API key
        const header = headers.authorization ?? "";
        const match = /^Bearer\s+(.+)$/i.exec(header);
        const name = match?.[1] ? config.apiKeys.get(match[1]) : undefined;
        if (name) return { actor: { kind: "api-key" as const, name } as Actor };

        return { actor: { kind: "anonymous" } as Actor };
      })();
    },
  },
});

// ── Session helpers (used by auth routes) ──────────────────────────────────

export { SESSION_COOKIE, hashToken };

export async function createSession(userId: string): Promise<string> {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  const { db } = getDb();
  await db.insert(schema.sessions).values({ tokenHash, userId, expiresAt });
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const { db } = getDb();
  await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, tokenHash));
}
