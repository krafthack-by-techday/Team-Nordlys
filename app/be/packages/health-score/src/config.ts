/**
 * Health-score tunable configuration — all values sourced from env with
 * conservative defaults. Adjustable at runtime via env vars.
 */

export const healthConfig = {
  /** EWMA smoothing factor (0–1). Lower = more conservative. */
  ewmaAlpha: Number(process.env.HEALTH_EWMA_ALPHA ?? 0.1),

  /** RTT thresholds (ms). */
  rttGoodMs: Number(process.env.HEALTH_RTT_GOOD_MS ?? 200),
  rttBadMs: Number(process.env.HEALTH_RTT_BAD_MS ?? 3000),

  /** Score below which a Varde is deprioritized (moved to end of list). */
  deprioritizeThreshold: Number(process.env.HEALTH_DEPRIORITIZE_THRESHOLD ?? 30),

  /** Score below which health alerts are emitted. */
  alertThreshold: Number(process.env.HEALTH_ALERT_THRESHOLD ?? 30),

  /** Hysteresis: score must stay below threshold for this long before acting (ms). */
  hysteresisMs: Number(process.env.HEALTH_HYSTERESIS_MS ?? 30000),

  /** Minimum tunnels always maintained regardless of scores. */
  minTunnels: Number(process.env.HEALTH_MIN_TUNNELS ?? 2),

  /** Minimum cooldown between tunnel swaps (ms). */
  swapCooldownMs: Number(process.env.HEALTH_SWAP_COOLDOWN_MS ?? 60000),

  /** Bonus points for currently-connected Vardes (sticky bias). */
  stickyBonus: Number(process.env.HEALTH_STICKY_BONUS ?? 15),

  /** Absolute floor — scores never go below this. */
  scoreFloor: Number(process.env.HEALTH_SCORE_FLOOR ?? 20),

  /** PONG timeout — if no PONG within this window, record bad sample (ms). */
  pongTimeoutMs: Number(process.env.HEALTH_PONG_TIMEOUT_MS ?? 5000),

  /** Cooldown between health alerts for the same Varde (ms). */
  alertCooldownMs: Number(process.env.HEALTH_ALERT_COOLDOWN_MS ?? 600000),
} as const;
