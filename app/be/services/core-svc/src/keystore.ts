import { generateKeypair, type Keypair } from "@nordlys/crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config";

const KEYS_DIR = process.env.KEYS_DIR ?? "/data/nordlys/keys";

let cached: Keypair | null = null;

export function getKeypair(): Keypair {
  if (cached) return cached;

  // 1. Env vars (highest priority — Docker secrets or explicit config)
  if (config.publicKey && config.privateKey) {
    cached = { publicKey: config.publicKey, privateKey: config.privateKey };
    return cached;
  }

  // 2. Filesystem (written by setup wizard)
  const privPath = join(KEYS_DIR, "ed25519.key");
  const pubPath = join(KEYS_DIR, "ed25519.pub");
  if (existsSync(privPath) && existsSync(pubPath)) {
    cached = {
      publicKey: readFileSync(pubPath, "utf-8").trim(),
      privateKey: readFileSync(privPath, "utf-8").trim(),
    };
    console.log(`[core-svc] loaded keypair from ${KEYS_DIR}`);
    return cached;
  }

  // 3. Ephemeral (dev only — not suitable for production)
  cached = generateKeypair();
  console.log(
    `[core-svc] generated ephemeral keypair — run setup or set NODE_PUBLIC_KEY / NODE_PRIVATE_KEY for stable identity`,
  );
  return cached;
}
