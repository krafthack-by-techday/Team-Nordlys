import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";

// Set API_KEYS before config module loads so the key map is populated.
process.env.API_KEYS = "splunk-prod:secret-abc,sentinel:secret-xyz";
// No DATABASE_URL needed — api-gateway config does not require it.

const { authMacro } = await import("./auth");

// Build a minimal test app that exercises both auth macros.
const testApp = new Elysia()
  .use(authMacro)
  .get(
    "/protected",
    ({ actor }) => ({ ok: true, actor }),
    { requireApiKey: true },
  )
  .get(
    "/optional",
    ({ actor }) => ({ ok: true, actor }),
    { optionalAuth: true },
  );

async function get(path: string, headers: Record<string, string> = {}) {
  return testApp.handle(
    new Request(`http://localhost${path}`, { headers }),
  );
}

describe("requireApiKey", () => {
  test("returns 401 when Authorization header is absent", async () => {
    const res = await get("/protected");
    expect(res.status).toBe(401);
  });

  test("returns 401 when Bearer token is invalid", async () => {
    const res = await get("/protected", { authorization: "Bearer wrong-key" });
    expect(res.status).toBe(401);
  });

  test("returns 401 for non-Bearer schemes (Basic auth)", async () => {
    const res = await get("/protected", { authorization: "Basic dXNlcjpwYXNz" });
    expect(res.status).toBe(401);
  });

  test("accepts a valid API key and resolves actor name", async () => {
    const res = await get("/protected", { authorization: "Bearer secret-abc" });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; actor: { kind: string; name: string } };
    expect(body.ok).toBe(true);
    expect(body.actor.kind).toBe("api-key");
    expect(body.actor.name).toBe("splunk-prod");
  });

  test("accepts the second configured API key", async () => {
    const res = await get("/protected", { authorization: "Bearer secret-xyz" });
    expect(res.status).toBe(200);
    const body = await res.json() as { actor: { name: string } };
    expect(body.actor.name).toBe("sentinel");
  });
});

describe("optionalAuth", () => {
  test("falls back to anonymous actor when no Authorization header", async () => {
    const res = await get("/optional");
    expect(res.status).toBe(200);
    const body = await res.json() as { actor: { kind: string } };
    expect(body.actor.kind).toBe("anonymous");
  });

  test("resolves to api-key actor when valid key provided", async () => {
    const res = await get("/optional", { authorization: "Bearer secret-abc" });
    expect(res.status).toBe(200);
    const body = await res.json() as { actor: { kind: string; name: string } };
    expect(body.actor.kind).toBe("api-key");
    expect(body.actor.name).toBe("splunk-prod");
  });

  test("falls back to anonymous when token is unrecognised (no 401)", async () => {
    const res = await get("/optional", { authorization: "Bearer garbage-token" });
    expect(res.status).toBe(200);
    const body = await res.json() as { actor: { kind: string } };
    expect(body.actor.kind).toBe("anonymous");
  });
});
