import { Elysia, t } from "elysia";
import { authMacro } from "../auth";
import { config } from "../config";

/**
 * Invite management — only available on KraftCert hub nodes.
 * Proxies to core-svc /invites endpoint.
 */
export const inviteRoutes = new Elysia({ prefix: "/invites" })
  .use(authMacro)
  .post(
    "",
    async ({ body, set }) => {
      const resp = await fetch(`${config.services.core}/invites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ company: body.company }),
      });
      set.status = resp.status;
      return await resp.json();
    },
    {
      requireSession: true,
      body: t.Object({
        company: t.String({ minLength: 1 }),
      }),
    },
  )
  .get(
    "",
    async ({ set }) => {
      const resp = await fetch(`${config.services.core}/invites`, {
        method: "GET",
      });
      set.status = resp.status;
      return await resp.json();
    },
    { requireSession: true },
  );

/**
 * Revoke a peer identity. KraftCERT-only (enforced by core-svc).
 */
export const revokeRoutes = new Elysia()
  .use(authMacro)
  .post(
    "/revoke",
    async ({ body, set }) => {
      const resp = await fetch(`${config.services.core}/revoke`, {
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
        reason: t.Optional(t.String()),
      }),
    },
  );
