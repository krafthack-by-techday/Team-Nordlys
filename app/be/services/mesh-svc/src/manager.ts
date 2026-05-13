import type { ClientMsg } from "@nordlys/ws-protocol";
import { config } from "./config";
import { healthTracker } from "./health";
import { pickTopN, type VardeCandidate } from "./rendezvous";
import { bootstrapRoster, loadRosterFromDb } from "./roster";
import { Tunnel } from "./tunnel";

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

// Holds the current top-N tunnel set. On roster-change it diffs against the
// new top-N and starts/stops tunnels accordingly.
class TunnelManager {
  private tunnels = new Map<string, Tunnel>();
  private lastSwapAt = 0;

  async refresh(): Promise<void> {
    const dbRoster = await loadRosterFromDb();
    const candidates: VardeCandidate[] = dbRoster.length
      ? dbRoster
      : bootstrapRoster(config.vardeBootstrap);

    if (candidates.length === 0) {
      console.warn("[mesh-svc] no Varde candidates available");
      return;
    }

    // Build scores map with sticky bonus for currently-connected
    const rawScores = healthTracker.getAllScores();
    const scores = new Map<string, number>();
    for (const c of candidates) {
      let s = rawScores.get(c.varde_id) ?? 100;
      if (this.tunnels.has(keyOf(c))) {
        s = Math.min(100, s + config.healthStickyBonus);
      }
      scores.set(c.varde_id, s);
    }

    const top = pickTopN(config.nodeId, candidates, config.vardeTopN, {
      scores,
      threshold: config.healthDeprioritizeThreshold,
      minResults: config.healthMinTunnels,
    });
    const wantedKeys = new Set(top.map((c) => keyOf(c)));

    // Rate-limit swaps
    const now = Date.now();
    const canSwap = (now - this.lastSwapAt) >= config.healthSwapCooldownMs;

    // Stop tunnels no longer in the top-N (rate-limited)
    for (const [key, tunnel] of this.tunnels) {
      if (!wantedKeys.has(key)) {
        if (!canSwap && this.tunnels.size >= config.healthMinTunnels) {
          // Skip this swap — too soon
          continue;
        }
        tunnel.stop();
        this.tunnels.delete(key);
        this.lastSwapAt = now;
        console.log(`[mesh-svc] tunnel rotated out: ${key} (score=${scores.get(tunnel.varde.varde_id)?.toFixed(0) ?? "?"})`);
      }
    }

    // Start tunnels missing from the top-N
    for (const candidate of top) {
      const key = keyOf(candidate);
      if (this.tunnels.has(key)) continue;
      if (!canSwap && this.tunnels.size >= config.healthMinTunnels) continue;
      const tunnel = new Tunnel(candidate);
      tunnel.start();
      this.tunnels.set(key, tunnel);
      this.lastSwapAt = now;
      console.log(`[mesh-svc] tunnel rotated in: ${key} (score=${scores.get(candidate.varde_id)?.toFixed(0) ?? "?"})`);
    }
  }

  broadcast(msg: DistributiveOmit<ClientMsg, "seq">): {
    sent: number;
    skipped: number;
  } {
    let sent = 0;
    let skipped = 0;
    for (const tunnel of this.tunnels.values()) {
      if (tunnel.send(msg)) sent++;
      else skipped++;
    }
    return { sent, skipped };
  }

  status(): Array<{ key: string; varde_id: string; open: boolean }> {
    return [...this.tunnels.values()].map((t) => ({
      key: t.key,
      varde_id: t.varde.varde_id,
      open: t.isOpen,
    }));
  }

  stopAll(): void {
    for (const tunnel of this.tunnels.values()) tunnel.stop();
    this.tunnels.clear();
  }
}

function keyOf(c: VardeCandidate): string {
  return `${c.varde_id}@${c.url}`;
}

export const manager = new TunnelManager();
