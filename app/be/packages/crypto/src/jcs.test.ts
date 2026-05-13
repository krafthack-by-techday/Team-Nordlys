import { describe, expect, test } from "bun:test";
import { canonicalize } from "./jcs";

describe("JCS canonicalization", () => {
  test("sorts object keys lexicographically", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  test("recursively canonicalizes nested objects", () => {
    expect(canonicalize({ outer: { z: 1, a: 2 } })).toBe(
      '{"outer":{"a":2,"z":1}}',
    );
  });

  test("preserves array order", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
  });

  test("drops undefined values but not null", () => {
    expect(canonicalize({ a: null, b: undefined, c: 1 })).toBe(
      '{"a":null,"c":1}',
    );
  });

  test("escapes strings via JSON.stringify", () => {
    expect(canonicalize('hi "you"')).toBe('"hi \\"you\\""');
  });

  test("rejects NaN and Infinity", () => {
    expect(() => canonicalize(Number.NaN)).toThrow();
    expect(() => canonicalize(Number.POSITIVE_INFINITY)).toThrow();
  });

  test("UTF-16 ordering matches JCS spec", () => {
    // 'A' < 'a' < 'å' (å) in UTF-16 code-unit order
    expect(canonicalize({ å: 1, A: 2, a: 3 })).toBe('{"A":2,"a":3,"å":1}');
  });
});
