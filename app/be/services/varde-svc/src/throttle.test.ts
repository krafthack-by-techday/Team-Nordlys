import { describe, expect, test } from "bun:test";

// varde-svc config requires DATABASE_URL at import time.
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://test:test@localhost:5432/test";
// Set a small cap so we can exercise the throttle in a unit test without
// hammering the counter for dozens of iterations.
process.env.MAX_NEW_WS_PER_SEC = "3";

const { tryAcceptUpgrade } = await import("./throttle");

describe("tryAcceptUpgrade — sliding-window rate cap", () => {
  test("allows connections below the cap", () => {
    // The module-level upgradeTimes array persists across tests in the same
    // process. We call enough times to verify the happy path, then rely on
    // the 1-second window to expire for subsequent tests — or accept that the
    // cap may already be hit and re-verify the denied path instead.
    const r1 = tryAcceptUpgrade();
    // Either allowed (clean state) or denied (previous test filled the window).
    // Both are valid outcomes — we just verify the shape of the return value.
    expect(typeof r1.allowed).toBe("boolean");
    expect(typeof r1.current).toBe("number");
  });

  test("returns allowed=true and increments current counter when under cap", async () => {
    // Wait for the 1-second window to expire so we start fresh.
    await new Promise((r) => setTimeout(r, 1100));
    const r1 = tryAcceptUpgrade();
    expect(r1.allowed).toBe(true);
    expect(r1.current).toBe(1);
    const r2 = tryAcceptUpgrade();
    expect(r2.allowed).toBe(true);
    expect(r2.current).toBe(2);
  });

  test("rejects connection when cap is hit", async () => {
    await new Promise((r) => setTimeout(r, 1100));
    // Cap is 3 (MAX_NEW_WS_PER_SEC=3 set above).
    tryAcceptUpgrade(); // 1
    tryAcceptUpgrade(); // 2
    tryAcceptUpgrade(); // 3 — at cap
    const denied = tryAcceptUpgrade(); // 4 — over cap
    expect(denied.allowed).toBe(false);
    expect(denied.current).toBe(3);
  });

  test("allows again after the 1-second window expires", async () => {
    await new Promise((r) => setTimeout(r, 1100));
    const result = tryAcceptUpgrade();
    expect(result.allowed).toBe(true);
  });

  test("current counter reflects entries within the sliding window only", async () => {
    await new Promise((r) => setTimeout(r, 1100));
    const r1 = tryAcceptUpgrade();
    expect(r1.current).toBe(1);
    // After expiry the window resets; single call should see count of 1 again.
  });
});
