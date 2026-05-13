import { generateKeypair, type Keypair } from "@nordlys/crypto";
import { config } from "./config";

let cached: Keypair | null = null;

export function getVardeKeypair(): Keypair {
  if (cached) return cached;
  if (config.publicKey && config.privateKey) {
    cached = { publicKey: config.publicKey, privateKey: config.privateKey };
  } else {
    cached = generateKeypair();
    console.log(
      `[varde-svc] generated ephemeral Varde keypair — set VARDE_PUBLIC_KEY / VARDE_PRIVATE_KEY for stable identity`,
    );
  }
  return cached;
}
