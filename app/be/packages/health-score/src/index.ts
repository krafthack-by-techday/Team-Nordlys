/**
 * @nordlys/health-score — EWMA-based health scoring for Varde tunnels.
 *
 * Usage:
 *   import { HealthScoreTracker } from "@nordlys/health-score";
 *   const tracker = new HealthScoreTracker();
 *   tracker.recordRtt("varde-1", 150);
 *   tracker.getScore("varde-1"); // 0–100
 */

export { healthConfig } from "./config";
export { type Signal, type SignalType } from "./signals";
export {
  type VardeHealthState,
  createHealthState,
  applySignal,
  decayToward100,
  isDeprioritized,
} from "./score";
export { initPersistence, persistState, restoreState, restoreAll } from "./persistence";

import { createHealthState, applySignal, decayToward100, isDeprioritized, type VardeHealthState } from "./score";
import { healthConfig } from "./config";
import { persistState, restoreAll, initPersistence } from "./persistence";
import type { Signal } from "./signals";

export class HealthScoreTracker {
  private states = new Map<string, VardeHealthState>();
  private persistInterval: ReturnType<typeof setInterval> | null = null;

  constructor(dbPath?: string) {
    if (dbPath) {
      initPersistence(dbPath);
      const restored = restoreAll();
      for (const [id, partial] of restored) {
        const state = createHealthState(id);
        Object.assign(state, partial);
        this.states.set(id, state);
      }
    }
    // Persist every 60s
    this.persistInterval = setInterval(() => this.persistAll(), 60_000);
  }

  private getOrCreate(vardeId: string): VardeHealthState {
    let s = this.states.get(vardeId);
    if (!s) {
      s = createHealthState(vardeId);
      this.states.set(vardeId, s);
    }
    return s;
  }

  recordRtt(vardeId: string, rttMs: number): number {
    const state = this.getOrCreate(vardeId);
    return applySignal(state, { type: "rtt", value: rttMs, timestamp: Date.now() });
  }

  recordPongTimeout(vardeId: string): number {
    const state = this.getOrCreate(vardeId);
    return applySignal(state, { type: "pong_timeout", value: 0, timestamp: Date.now() });
  }

  recordDisconnect(vardeId: string): number {
    const state = this.getOrCreate(vardeId);
    return applySignal(state, { type: "disconnect", value: 1, timestamp: Date.now() });
  }

  recordReconnect(vardeId: string): number {
    const state = this.getOrCreate(vardeId);
    return applySignal(state, { type: "reconnect", value: 0, timestamp: Date.now() });
  }

  recordDeliveryLatency(vardeId: string, latencyMs: number): number {
    const state = this.getOrCreate(vardeId);
    return applySignal(state, { type: "delivery_latency", value: latencyMs, timestamp: Date.now() });
  }

  /** Call periodically (e.g., on each ping) to let idle scores recover. */
  decay(vardeId: string): void {
    const state = this.states.get(vardeId);
    if (state) decayToward100(state);
  }

  getScore(vardeId: string): number {
    return this.states.get(vardeId)?.score ?? 100;
  }

  getState(vardeId: string): VardeHealthState | undefined {
    return this.states.get(vardeId);
  }

  getAllScores(): Map<string, number> {
    const result = new Map<string, number>();
    for (const [id, state] of this.states) {
      result.set(id, state.score);
    }
    return result;
  }

  getAllStates(): Map<string, VardeHealthState> {
    return new Map(this.states);
  }

  isDeprioritized(vardeId: string): boolean {
    const state = this.states.get(vardeId);
    if (!state) return false;
    return isDeprioritized(state);
  }

  private persistAll(): void {
    for (const state of this.states.values()) {
      persistState(state);
    }
  }

  stop(): void {
    if (this.persistInterval) {
      clearInterval(this.persistInterval);
      this.persistInterval = null;
    }
    this.persistAll();
  }
}
