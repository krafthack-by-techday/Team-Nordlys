import { createHash } from "node:crypto";

// Rendezvous hashing (Highest Random Weight). For each candidate we compute
// hash(nodeId + candidateId); the top-N highest scores win. Adding or
// removing a candidate only re-routes ~N/M nodes, which is what we want for
// stable Varde-tunnel selection at 400-node scale.

export interface VardeCandidate {
  varde_id: string;
  url: string;
}

function score(nodeId: string, candidateId: string): bigint {
  const digest = createHash("sha256")
    .update(`${nodeId}|${candidateId}`)
    .digest();
  // Use the first 8 bytes as a 64-bit unsigned integer.
  return digest.readBigUInt64BE(0);
}

/**
 * Pick top-N candidates by rendezvous hash, with optional score-aware
 * threshold: candidates with health score < threshold are moved to the
 * end (last-resort). They are NEVER excluded — just deprioritized.
 *
 * Always returns at least `minResults` candidates (default 2).
 */
export function pickTopN(
  nodeId: string,
  candidates: readonly VardeCandidate[],
  n: number,
  options?: {
    scores?: Map<string, number>;
    threshold?: number;
    minResults?: number;
  },
): VardeCandidate[] {
  if (candidates.length === 0) return [];

  const ranked = [...candidates]
    .map((c) => ({ c, s: score(nodeId, c.varde_id) }))
    .sort((a, b) => (b.s > a.s ? 1 : b.s < a.s ? -1 : 0));

  if (!options?.scores || !options.threshold) {
    return ranked.slice(0, n).map((x) => x.c);
  }

  const { scores, threshold, minResults = 2 } = options;

  // Partition into healthy and deprioritized
  const healthy: VardeCandidate[] = [];
  const deprioritized: VardeCandidate[] = [];

  for (const { c } of ranked) {
    const s = scores.get(c.varde_id) ?? 100;
    if (s >= threshold) {
      healthy.push(c);
    } else {
      deprioritized.push(c);
    }
  }

  // Healthy first, then deprioritized as last-resort
  const combined = [...healthy, ...deprioritized];
  const count = Math.max(minResults, n);
  return combined.slice(0, count);
}
