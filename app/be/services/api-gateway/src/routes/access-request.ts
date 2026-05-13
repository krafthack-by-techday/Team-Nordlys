import { Elysia, t } from "elysia";
import { authMacro } from "../auth";
import { config } from "../config";

/**
 * Generates a signed access-request JSON for delivery to KraftCert.
 * Proxies to core-svc which has access to the node's signing key.
 * No auth required — this runs during setup before a session exists.
 */
export const accessRequestRoutes = new Elysia({ prefix: "/access-request" })
  .post(
    "",
    async ({ body, set }) => {
      const resp = await fetch(`${config.services.core}/access-request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      set.status = resp.status;
      return await resp.json();
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

/**
 * KraftCERT approve endpoint — verifies access request signature and issues invite.
 * Requires authenticated session (KraftCERT operator).
 */
export const accessRequestApproveRoutes = new Elysia({ prefix: "/access-requests" })
  .use(authMacro)
  .post(
    "/approve",
    async ({ body, set }) => {
      const resp = await fetch(`${config.services.core}/access-requests/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      set.status = resp.status;
      return await resp.json();
    },
    {
      requireSession: true,
      body: t.Object({
        node_id: t.String(),
        company: t.String(),
        public_key: t.String(),
        contact: t.Object({
          name: t.String(),
          email: t.String({ format: "email" }),
          phone: t.Optional(t.String()),
        }),
        requested_at: t.String(),
        signature: t.String(),
      }),
    },
  );
