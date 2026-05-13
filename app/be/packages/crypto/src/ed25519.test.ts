import { describe, expect, test } from "bun:test";
import { generateKeypair, sign, verify } from "./ed25519";
import { signObject, verifyObject } from "./sign";

describe("Ed25519", () => {
  test("generated keypair has 32-byte raw keys (base64)", () => {
    const { publicKey, privateKey } = generateKeypair();
    expect(Buffer.from(publicKey, "base64").length).toBe(32);
    expect(Buffer.from(privateKey, "base64").length).toBe(32);
  });

  test("sign + verify round-trip", () => {
    const { publicKey, privateKey } = generateKeypair();
    const msg = new TextEncoder().encode("hello mesh");
    const sig = sign(msg, privateKey);
    expect(verify(msg, sig, publicKey)).toBe(true);
  });

  test("verify fails with tampered message", () => {
    const { publicKey, privateKey } = generateKeypair();
    const msg = new TextEncoder().encode("hello mesh");
    const sig = sign(msg, privateKey);
    const tampered = new TextEncoder().encode("hello mesh!");
    expect(verify(tampered, sig, publicKey)).toBe(false);
  });

  test("verify fails with wrong public key", () => {
    const a = generateKeypair();
    const b = generateKeypair();
    const msg = new TextEncoder().encode("hello");
    const sig = sign(msg, a.privateKey);
    expect(verify(msg, sig, b.publicKey)).toBe(false);
  });
});

describe("signObject / verifyObject", () => {
  test("signs canonicalized form and verifies", () => {
    const { publicKey, privateKey } = generateKeypair();
    const event = {
      id: "abc",
      title: "test",
      severity: "low" as const,
      created_at: "2026-05-01T00:00:00Z",
    };
    const signature = signObject(event, privateKey);
    expect(verifyObject({ ...event, signature }, publicKey)).toBe(true);
  });

  test("ignores existing signature field when re-signing", () => {
    const { publicKey, privateKey } = generateKeypair();
    const obj = { x: 1, signature: "garbage" };
    const sig = signObject(obj, privateKey);
    expect(verifyObject({ x: 1, signature: sig }, publicKey)).toBe(true);
  });

  test("verifies same regardless of key insertion order", () => {
    const { publicKey, privateKey } = generateKeypair();
    const a = { z: 1, a: 2, m: 3 };
    const b = { m: 3, a: 2, z: 1 };
    const sig = signObject(a, privateKey);
    expect(verifyObject({ ...b, signature: sig }, publicKey)).toBe(true);
  });
});
