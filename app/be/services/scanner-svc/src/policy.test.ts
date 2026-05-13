import { describe, expect, test } from "bun:test";

// scanner-svc config requires DATABASE_URL at import time; provide a dummy
// value so the module loads without throwing in the test environment.
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://test:test@localhost:5432/test";

// Dynamic import to ensure env var is set before the module resolves config.
const { isAllowedTarget } = await import("./policy");

describe("isAllowedTarget — default private-range whitelist", () => {
  // Default whitelist: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8
  // SCANNER_ALLOW_EXTERNAL is false in tests.

  test("allows address in 192.168.0.0/16", () => {
    expect(isAllowedTarget("192.168.1.100")).toBe(true);
  });

  test("allows address in 10.0.0.0/8", () => {
    expect(isAllowedTarget("10.42.0.5")).toBe(true);
  });

  test("allows loopback 127.0.0.1 (127.0.0.0/8)", () => {
    expect(isAllowedTarget("127.0.0.1")).toBe(true);
  });

  test("allows address in 172.16.0.0/12 (172.16–172.31)", () => {
    expect(isAllowedTarget("172.20.5.3")).toBe(true);
  });

  test("rejects public IPv4 address outside whitelist", () => {
    expect(isAllowedTarget("8.8.8.8")).toBe(false);
  });

  test("rejects another public address (Cloudflare DNS)", () => {
    expect(isAllowedTarget("1.1.1.1")).toBe(false);
  });

  test("rejects address at the boundary just outside 172.16.0.0/12 (172.32.x.x)", () => {
    // 172.32.0.0 is outside the /12 block (which covers 172.16.0.0–172.31.255.255)
    expect(isAllowedTarget("172.32.0.1")).toBe(false);
  });

  test("rejects malformed address that is not a valid IPv4", () => {
    expect(isAllowedTarget("not-an-ip")).toBe(false);
  });

  test("rejects empty string", () => {
    expect(isAllowedTarget("")).toBe(false);
  });

  test("allows address at the start of 10.0.0.0/8 boundary", () => {
    expect(isAllowedTarget("10.0.0.0")).toBe(true);
  });

  test("rejects address just outside 10.0.0.0/8 (11.x.x.x)", () => {
    expect(isAllowedTarget("11.0.0.0")).toBe(false);
  });
});
