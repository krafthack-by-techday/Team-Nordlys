import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { schema, getDb } from "@nordlys/db";
import { createSession, deleteSession, SESSION_COOKIE, hashToken } from "../auth";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post(
    "/login",
    async ({ body, set, cookie }) => {
      const { db } = getDb();
      const rows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, body.email.toLowerCase().trim()))
        .limit(1);

      const user = rows[0];
      if (!user || !user.passwordHash) {
        set.status = 401;
        return { error: "invalid_credentials" };
      }

      const valid = await Bun.password.verify(body.password, user.passwordHash);
      if (!valid) {
        set.status = 401;
        return { error: "invalid_credentials" };
      }

      const token = await createSession(user.id);
      (cookie as any)[SESSION_COOKIE].set({
        value: token,
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
        maxAge: 86400,
      });

      return { ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 12, maxLength: 128 }),
      }),
    },
  )
  .post("/logout", async ({ cookie }) => {
    const token = (cookie as any)?.[SESSION_COOKIE]?.value;
    if (token) {
      await deleteSession(token);
      (cookie as any)[SESSION_COOKIE].set({
        value: "",
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
    }
    return { ok: true };
  })
  .get("/me", async ({ cookie }) => {
    const { db } = getDb();

    // Check node state first
    const stateRows = await db.select().from(schema.nodeState).limit(1);
    const state = stateRows[0];
    if (!state || state.status === "uninitialized") {
      return { setup_required: true };
    }
    if (state.status === "pending") {
      return { setup_pending: true };
    }

    // Resolve session
    const token = (cookie as any)?.[SESSION_COOKIE]?.value;
    if (!token) {
      return { authenticated: false };
    }
    const tokenHash = hashToken(token);
    const rows = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
      })
      .from(schema.sessions)
      .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
      .where(eq(schema.sessions.tokenHash, tokenHash))
      .limit(1);

    const user = rows[0];
    if (!user) {
      return { authenticated: false };
    }
    return { authenticated: true, user };
  });
