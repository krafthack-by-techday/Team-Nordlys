// JCS (RFC 8785) — JSON Canonicalization Scheme.
// Stable byte-level serialization required for signature verification across
// implementations. Object keys sorted lexicographically (UTF-16 code units),
// no whitespace, numbers in shortest round-trip form, strings JSON-escaped.

export function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return canonicalizeNumber(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort(compareUtf16);
    return (
      "{" +
      keys
        .map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k]))
        .join(",") +
      "}"
    );
  }
  throw new TypeError(`Cannot canonicalize value of type ${typeof value}`);
}

function canonicalizeNumber(n: number): string {
  if (!Number.isFinite(n)) {
    throw new RangeError("JCS does not permit NaN or Infinity");
  }
  if (n === 0) return "0";
  // RFC 8785 §3.2.2: ECMAScript Number.prototype.toString produces the
  // shortest round-trippable representation that JCS requires.
  return String(n);
}

function compareUtf16(a: string, b: string): number {
  // String comparison in JS is already by UTF-16 code unit, which matches
  // JCS §3.2.3 ("UCS-2 / UTF-16 code units").
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function canonicalizeToBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalize(value));
}
