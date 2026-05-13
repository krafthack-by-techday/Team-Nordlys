import { canonicalizeToBytes } from "./jcs";
import { sign, verify } from "./ed25519";

export interface SignOptions {
  // Fields excluded before canonicalization. The signature itself is always
  // excluded automatically.
  exclude?: readonly string[];
}

const ALWAYS_EXCLUDED = ["signature"];

export function signObject<T extends object>(
  obj: T,
  privateKeyBase64: string,
  opts: SignOptions = {},
): string {
  const bytes = canonicalizeToBytes(stripFields(obj, opts.exclude));
  return sign(bytes, privateKeyBase64);
}

export function verifyObject<T extends { signature: string }>(
  obj: T,
  publicKeyBase64: string,
  opts: SignOptions = {},
): boolean {
  const bytes = canonicalizeToBytes(stripFields(obj, opts.exclude));
  return verify(bytes, obj.signature, publicKeyBase64);
}

function stripFields(
  obj: object,
  exclude: readonly string[] = [],
): Record<string, unknown> {
  const drop = new Set([...ALWAYS_EXCLUDED, ...exclude]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (drop.has(k)) continue;
    out[k] = v;
  }
  return out;
}
