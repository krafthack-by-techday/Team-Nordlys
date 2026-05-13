import { describe, expect, test } from "bun:test";
import { pickTopN, type VardeCandidate } from "./rendezvous";

const makeVarder = (n: number): VardeCandidate[] =>
  Array.from({ length: n }, (_, i) => ({
    varde_id: `varde-${i + 1}`,
    url: `https://varde-${i + 1}.example.com`,
  }));

describe("pickTopN — rendezvous hashing", () => {
  test("returns empty array when no candidates", () => {
    expect(pickTopN("hafslund-1", [], 3)).toEqual([]);
  });

  test("returns all candidates when fewer than N available", () => {
    const varder = makeVarder(2);
    const result = pickTopN("hafslund-1", varder, 5);
    expect(result.length).toBe(2);
  });

  test("returns exactly N candidates when enough are available", () => {
    const varder = makeVarder(10);
    const result = pickTopN("hafslund-1", varder, 3);
    expect(result.length).toBe(3);
  });

  test("selection is deterministic for the same nodeId", () => {
    const varder = makeVarder(10);
    const a = pickTopN("statkraft-1", varder, 3);
    const b = pickTopN("statkraft-1", varder, 3);
    expect(a.map((v) => v.varde_id)).toEqual(b.map((v) => v.varde_id));
  });

  test("different nodes may select different top-N varder (uniform distribution)", () => {
    const varder = makeVarder(5);
    const nodeIds = Array.from({ length: 20 }, (_, i) => `node-${i + 1}`);
    const selections = nodeIds.map((id) =>
      pickTopN(id, varder, 1).map((v) => v.varde_id),
    );
    const uniqueSelected = new Set(selections.flat());
    // With 20 nodes picking 1 of 5, we expect all 5 Varder to be selected by
    // at least one node (with overwhelming probability for a HRW implementation).
    expect(uniqueSelected.size).toBe(5);
  });

  test("adding a new Varde only re-routes a fraction of slots (min disruption)", () => {
    // With rendezvous hashing, adding 1 Varde to a pool of M candidates should
    // re-route approximately N/M of the top-N selections across all nodes.
    // Here M=5→6 so ≈1/6 ≈ 17% of per-node slots should change.
    // A naive shuffle would change far more — this test verifies that at least
    // 40% of nodes keep ALL their top-3 unchanged (i.e. disruption is bounded).
    const original = makeVarder(5);
    const extended = [...makeVarder(5), { varde_id: "varde-6", url: "https://varde-6.example.com" }];
    const nodeIds = Array.from({ length: 100 }, (_, i) => `node-${i + 1}`);

    let unchanged = 0;
    for (const id of nodeIds) {
      const before = new Set(pickTopN(id, original, 3).map((v) => v.varde_id));
      const after = new Set(pickTopN(id, extended, 3).map((v) => v.varde_id));
      const intersection = [...after].filter((x) => before.has(x));
      if (intersection.length === 3) unchanged++;
    }
    // At least 40% of nodes should keep all 3 tunnels unchanged — rendezvous
    // hashing should greatly outperform a naive re-assignment here.
    expect(unchanged).toBeGreaterThan(nodeIds.length * 0.4);
  });

  test("returns selected candidates from the input list (not fabricated)", () => {
    const varder = makeVarder(8);
    const result = pickTopN("laerdal-2", varder, 3);
    const validIds = new Set(varder.map((v) => v.varde_id));
    for (const v of result) {
      expect(validIds.has(v.varde_id)).toBe(true);
    }
  });
});
