import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { schema, getDb } from "@nordlys/db";
import { authMacro } from "../auth";

export const settingsRoutes = new Elysia({ prefix: "/settings" })
  .use(authMacro)
  .get(
    "",
    async () => {
      const { db } = getDb();
      const rows = await db.select().from(schema.nodeSettings);
      const settings: Record<string, string> = {};
      for (const row of rows) settings[row.key] = row.value;
      return settings;
    },
    { requireSession: true },
  )
  .put(
    "/:key",
    async ({ params, body, set }) => {
      const { db } = getDb();
      await db
        .insert(schema.nodeSettings)
        .values({ key: params.key, value: body.value })
        .onConflictDoUpdate({
          target: schema.nodeSettings.key,
          set: { value: body.value, updatedAt: new Date() },
        });
      return { ok: true };
    },
    {
      requireSession: true,
      params: t.Object({ key: t.String() }),
      body: t.Object({ value: t.String() }),
    },
  )
  .delete(
    "/:key",
    async ({ params }) => {
      const { db } = getDb();
      await db.delete(schema.nodeSettings).where(eq(schema.nodeSettings.key, params.key));
      return { ok: true };
    },
    {
      requireSession: true,
      params: t.Object({ key: t.String() }),
    },
  );
