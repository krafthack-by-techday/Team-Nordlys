/**
 * EWMA-based health score calculation for a single Varde.
 *
 * Score range: [scoreFloor, 100]. Higher = healthier.
 * Starts at 100 (optimistic). Signals push it down; absence of bad signals
 * lets it recover toward 100 via decay.
 */

import { healthConfig } from "./config";
import type { Signal } from "./signals";

export interface VardeHealthState {
  vardeId: string;
  score: number;
  lastUpdate: number;
  /** Timestamp when score first dropped below threshold (for hysteresis). */
  belowThresholdSince: number | null;
  /** Connection tracking. */
  connectedAt: number | null;
  disconnectCount: number;
  lastRttMs: number | null;
  lastDeliveryLatencyMs: number | null;
}

export function createHealthState(vardeId: string): VardeHealthState {
  return {
    vardeId,
    score: 100,
    lastUpdate: Date.now(),
    belowThresholdSince: null,
    connectedAt: null,
    disconnectCount: 0,
    lastRttMs: null,
    lastDeliveryLatencyMs: null,
  };
}

/**
 * Apply a signal to update the health score using EWMA.
 * Returns the new score (clamped to [floor, 100]).
 */
export function applySignal(state: VardeHealthState, signal: Signal): number {
  const { ewmaAlpha, rttGoodMs, rttBadMs, scoreFloor } = healthConfig;

  let penalty: number;

  switch (signal.type) {
    case "rtt": {
      const quality = rttToQuality(signal.value, rttGoodMs, rttBadMs);
      state.score = ewma(state.score, quality, ewmaAlpha);
      state.lastRttMs = signal.value;
      break;
    }
    case "pong_timeout": {
      penalty = 15;
      state.score = Math.max(scoreFloor, state.score - penalty);
      break;
    }
    case "disconnect": {
      penalty = 10;
      state.disconnectCount++;
      state.connectedAt = null;
      state.score = Math.max(scoreFloor, state.score - penalty);
      break;
    }
    case "reconnect": {
      state.connectedAt = signal.timestamp;
      state.score = Math.min(100, state.score + 5);
      break;
    }
    case "delivery_latency": {
      const quality = rttToQuality(signal.value, rttGoodMs * 2, rttBadMs * 2);
      state.score = ewma(state.score, quality, ewmaAlpha * 0.5);
      state.lastDeliveryLatencyMs = signal.value;
      break;
    }
  }

  // Clamp
  state.score = Math.max(scoreFloor, Math.min(100, state.score));
  state.lastUpdate = signal.timestamp;

  // Hysteresis tracking
  if (state.score < healthConfig.deprioritizeThreshold) {
    if (state.belowThresholdSince === null) {
      state.belowThresholdSince = signal.timestamp;
    }
  } else {
    state.belowThresholdSince = null;
  }

  return state.score;
}

/**
 * Passive decay toward 100 — call periodically (e.g., every ping interval)
 * to let healthy-but-idle Vardes recover.
 */
export function decayToward100(state: VardeHealthState): void {
  if (state.score >= 99) { state.score = 100; return; }
  state.score = Math.min(100, state.score + 0.5);
  if (state.score >= healthConfig.deprioritizeThreshold) {
    state.belowThresholdSince = null;
  }
}

/** Whether this Varde is confirmed deprioritized (below threshold + hysteresis elapsed). */
export function isDeprioritized(state: VardeHealthState): boolean {
  if (state.score >= healthConfig.deprioritizeThreshold) return false;
  if (state.belowThresholdSince === null) return false;
  return (Date.now() - state.belowThresholdSince) >= healthConfig.hysteresisMs;
}

// ── Helpers ─────────────────────────────────────────────────────────

function rttToQuality(rttMs: number, goodMs: number, badMs: number): number {
  if (rttMs <= goodMs) return 100;
  if (rttMs >= badMs) return 0;
  return 100 * (1 - (rttMs - goodMs) / (badMs - goodMs));
}

function ewma(current: number, sample: number, alpha: number): number {
  return current * (1 - alpha) + sample * alpha;
}
