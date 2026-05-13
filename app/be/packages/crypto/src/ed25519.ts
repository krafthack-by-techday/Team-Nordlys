import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as nodeSign,
  verify as nodeVerify,
  type KeyObject,
} from "node:crypto";

export interface Keypair {
  publicKey: string;
  privateKey: string;
}

export function generateKeypair(): Keypair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKey: rawPublicKeyBase64(publicKey),
    privateKey: rawPrivateKeyBase64(privateKey),
  };
}

export function sign(message: Uint8Array, privateKeyBase64: string): string {
  const key = privateKeyFromBase64(privateKeyBase64);
  return nodeSign(null, message, key).toString("base64");
}

export function verify(
  message: Uint8Array,
  signatureBase64: string,
  publicKeyBase64: string,
): boolean {
  try {
    const key = publicKeyFromBase64(publicKeyBase64);
    const sig = Buffer.from(signatureBase64, "base64");
    return nodeVerify(null, message, key, sig);
  } catch {
    return false;
  }
}

// ── Internal: raw-key (RFC 8410) base64 <-> Node KeyObject ─────────────────

const ED25519_PUBLIC_DER_PREFIX = Buffer.from([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);

const ED25519_PRIVATE_DER_PREFIX = Buffer.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
  0x04, 0x22, 0x04, 0x20,
]);

function rawPublicKeyBase64(key: KeyObject): string {
  const der = key.export({ type: "spki", format: "der" });
  return der.subarray(ED25519_PUBLIC_DER_PREFIX.length).toString("base64");
}

function rawPrivateKeyBase64(key: KeyObject): string {
  const der = key.export({ type: "pkcs8", format: "der" });
  return der.subarray(ED25519_PRIVATE_DER_PREFIX.length).toString("base64");
}

function publicKeyFromBase64(b64: string): KeyObject {
  const raw = Buffer.from(b64, "base64");
  if (raw.length !== 32) {
    throw new Error(`Ed25519 public key must be 32 bytes, got ${raw.length}`);
  }
  const der = Buffer.concat([ED25519_PUBLIC_DER_PREFIX, raw]);
  return createPublicKey({ key: der, format: "der", type: "spki" });
}

function privateKeyFromBase64(b64: string): KeyObject {
  const raw = Buffer.from(b64, "base64");
  if (raw.length !== 32) {
    throw new Error(`Ed25519 private seed must be 32 bytes, got ${raw.length}`);
  }
  const der = Buffer.concat([ED25519_PRIVATE_DER_PREFIX, raw]);
  return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}
