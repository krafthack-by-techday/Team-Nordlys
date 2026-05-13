import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { signObject } from "@nordlys/crypto";
import { schema, getDb } from "@nordlys/db";
import { config } from "../config";
import { getKeypair } from "../keystore";

/**
 * Read node_settings value, preferring DB (setup-generated) over env config.
 */
async function getNodeSetting(key: string, fallback: string): Promise<string> {
  try {
    const { db } = getDb();
    const rows = await db
      .select({ value: schema.nodeSettings.value })
      .from(schema.nodeSettings)
      .where(eq(schema.nodeSettings.key, key))
      .limit(1);
    if (rows[0]?.value) return rows[0].value;
  } catch { /* fall through */ }
  return fallback;
}

/**
 * POST /access-request
 *
 * Generates a signed access-request blob that the node operator
 * sends to KraftCERT (out-of-band) to join the mesh.
 * The blob proves the node controls its private key.
 */
export const accessRequestRoutes = new Elysia().post(
  "/access-request",
  async ({ body }) => {
    const keypair = getKeypair();

    // Prefer setup-generated values from node_settings over env-based config
    const nodeId = await getNodeSetting("node_id", config.nodeId);
    const company = await getNodeSetting("company", config.company);

    const payload = {
      node_id: nodeId,
      company,
      public_key: keypair.publicKey,
      contact: body.contact,
      requested_at: new Date().toISOString(),
    };

    const signature = signObject(payload, keypair.privateKey);

    return { ...payload, signature };
  },
  {
    body: t.Object({
      contact: t.Object({
        name: t.String({ minLength: 1 }),
        email: t.String({ format: "email" }),
        phone: t.Optional(t.String()),
      }),
    }),
  },
);
