import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { schema, getDb } from "@nordlys/db";
import { slugify } from "@nordlys/contracts";
import { generateKeypair } from "@nordlys/crypto";
import { createSession, SESSION_COOKIE } from "../auth";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const KEYS_DIR = process.env.KEYS_DIR ?? "/data/nordlys/keys";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/1/I
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) code += chars[b % chars.length];
  return code;
}

/** Persist immutable node settings. Returns error string if key already exists. */
async function setImmutable(db: any, key: string, value: string): Promise<string | null> {
  const existing = await db
    .select({ value: schema.nodeSettings.value })
    .from(schema.nodeSettings)
    .where(eq(schema.nodeSettings.key, key))
    .limit(1);
  if (existing.length > 0) {
    return "field_immutable";
  }
  await db.insert(schema.nodeSettings).values({ key, value });
  return null;
}

export const setupRoutes = new Elysia({ prefix: "/setup" })
  /**
   * POST /v1/setup — create admin user + generate verification code.
   * Only works when 0 users exist.
   */
  .post(
    "",
    async ({ body, set }) => {
      const { db } = getDb();

      // Guard: only allow if no users exist
      const existingUsers = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
      if (existingUsers.length > 0) {
        set.status = 403;
        return { error: "setup_already_completed" };
      }

      // Generate node_id from company + nodeName
      const nodeId = `${slugify(body.company)}-${slugify(body.nodeName)}`;

      // Persist immutable fields. Default role to "peer"; KraftCERT nodes
      // upgrade to "kraftcert" via /self-activate.
      for (const [key, value] of [
        ["company", body.company],
        ["node_name", body.nodeName],
        ["node_id", nodeId],
        ["role", "peer"],
      ] as const) {
        const err = await setImmutable(db, key, value);
        if (err) {
          set.status = 409;
          return { error: "field_immutable", field: key };
        }
      }

      // Generate Ed25519 keypair and persist to filesystem
      const keypair = generateKeypair();
      mkdirSync(KEYS_DIR, { recursive: true, mode: 0o700 });
      writeFileSync(join(KEYS_DIR, "ed25519.key"), keypair.privateKey, { mode: 0o600 });
      writeFileSync(join(KEYS_DIR, "ed25519.pub"), keypair.publicKey, { mode: 0o644 });

      // Store public key in node_settings for easy access
      await setImmutable(db, "public_key", keypair.publicKey);

      // Hash password with argon2id
      const passwordHash = await Bun.password.hash(body.password, {
        algorithm: "argon2id",
        memoryCost: 65536,
        timeCost: 3,
      });

      // Create admin user
      const [user] = await db
        .insert(schema.users)
        .values({
          email: body.email.toLowerCase().trim(),
          name: body.name,
          passwordHash,
          provider: "local",
          role: "admin",
        })
        .returning({ id: schema.users.id });

      // Generate verification code (TTL 1 hour)
      const code = generateCode();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      // Upsert node state to pending
      await db
        .insert(schema.nodeState)
        .values({
          id: 1,
          status: "pending",
          setupCode: code,
          setupCodeExpiresAt: expiresAt,
          setupAttempts: 0,
        })
        .onConflictDoUpdate({
          target: schema.nodeState.id,
          set: {
            status: "pending",
            setupCode: code,
            setupCodeExpiresAt: expiresAt,
            setupAttempts: 0,
            updatedAt: new Date(),
          },
        });

      set.status = 201;
      return {
        ok: true,
        node_id: nodeId,
        verification: {
          code,
          command: `docker exec nordlys-v2 cli-verify ${code}`,
          expires_at: expiresAt.toISOString(),
        },
      };
    },
    {
      body: t.Object({
        company: t.String({ minLength: 1, maxLength: 128 }),
        nodeName: t.String({ minLength: 1, maxLength: 100 }),
        email: t.String({ format: "email" }),
        name: t.String({ minLength: 1, maxLength: 100 }),
        password: t.String({ minLength: 12, maxLength: 128 }),
      }),
    },
  )

  /**
   * POST /v1/setup/verify — verify the console code.
   * Localhost-only: validates source is 127.0.0.1 or container-internal.
   */
  .post(
    "/verify",
    async ({ body, set, request }) => {
      // Localhost guard
      const host = new URL(request.url).hostname;
      const forwarded = request.headers.get("x-forwarded-for");
      const isLocal =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        (!forwarded && host === "0.0.0.0");

      if (!isLocal) {
        set.status = 403;
        return { error: "localhost_only" };
      }

      const { db } = getDb();
      const stateRows = await db.select().from(schema.nodeState).where(eq(schema.nodeState.id, 1));
      const state = stateRows[0];

      if (!state || state.status !== "pending") {
        set.status = 400;
        return { error: "no_pending_setup" };
      }

      if (state.setupAttempts >= 5) {
        set.status = 429;
        return { error: "too_many_attempts" };
      }

      if (!state.setupCodeExpiresAt || state.setupCodeExpiresAt < new Date()) {
        set.status = 410;
        return { error: "code_expired" };
      }

      if (state.setupCode !== body.code.toUpperCase().trim()) {
        // Increment attempts
        await db
          .update(schema.nodeState)
          .set({ setupAttempts: state.setupAttempts + 1 })
          .where(eq(schema.nodeState.id, 1));
        set.status = 401;
        return { error: "invalid_code", attempts_remaining: 4 - state.setupAttempts };
      }

      // Activate node
      await db
        .update(schema.nodeState)
        .set({ status: "active", setupCode: null, setupCodeExpiresAt: null, updatedAt: new Date() })
        .where(eq(schema.nodeState.id, 1));

      return { ok: true, status: "active" };
    },
    {
      body: t.Object({
        code: t.String({ minLength: 6, maxLength: 6 }),
      }),
    },
  )

  /**
   * GET /v1/setup/status — poll for node activation status.
   */
  .get("/status", async () => {
    const { db } = getDb();
    const stateRows = await db.select().from(schema.nodeState).where(eq(schema.nodeState.id, 1));
    const state = stateRows[0];
    return { status: state?.status ?? "uninitialized" };
  })

  /**
   * POST /v1/setup/self-activate — KraftCERT nodes self-activate after setup.
   * Triggers core-svc to re-read node_settings and register identity.
   */
  .post("/self-activate", async ({ set }) => {
    const { config } = await import("../config");
    const resp = await fetch(`${config.services.core}/self-activate`, { method: "POST" });
    if (!resp.ok) {
      set.status = 502;
      return { error: "core_svc_error" };
    }
    return await resp.json();
  });
