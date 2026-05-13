import { config } from "./config";

// Lightweight CIDR/IP/host check. We allow a target if it matches any
// whitelist entry, OR if SCANNER_ALLOW_EXTERNAL=true. This is intentionally
// minimal — production should use a vetted CIDR library and source-IP
// authorization on top.

export function isAllowedTarget(target: string): boolean {
  if (config.allowExternal) return true;
  for (const allowed of config.whitelist) {
    if (matchesEntry(target, allowed)) return true;
  }
  return false;
}

function matchesEntry(target: string, entry: string): boolean {
  if (entry.includes("/")) return cidrMatch(target, entry);
  // Otherwise treat as exact host or IPv4 match.
  return target === entry;
}

function cidrMatch(target: string, cidr: string): boolean {
  const [base, prefixStr] = cidr.split("/");
  if (!base || !prefixStr) return false;
  const prefix = Number(prefixStr);
  const targetIp = ipv4ToInt(target);
  const baseIp = ipv4ToInt(base);
  if (targetIp === null || baseIp === null) return false;
  if (prefix < 0 || prefix > 32) return false;
  if (prefix === 0) return true;
  const mask = ((0xffffffff << (32 - prefix)) >>> 0);
  return (targetIp & mask) === (baseIp & mask);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    n = (n << 8) | octet;
  }
  return n >>> 0;
}
