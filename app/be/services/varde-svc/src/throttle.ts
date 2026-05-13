import { config } from "./config";

// Sliding-window counter for WS upgrade requests. Reconnect storms (a Varde
// restart can trigger 240 simultaneous reconnects in a 5-Varde mesh) are
// shed here so we never exhaust file descriptors. Excess connections get a
// 503; node mesh-svc backoff handles retry.

const upgradeTimes: number[] = [];

export function tryAcceptUpgrade(): { allowed: boolean; current: number } {
  const now = Date.now();
  const cutoff = now - 1000;
  // Drop entries older than the 1s window.
  while (upgradeTimes.length > 0 && upgradeTimes[0]! < cutoff) {
    upgradeTimes.shift();
  }
  if (upgradeTimes.length >= config.maxNewConnectionsPerSec) {
    return { allowed: false, current: upgradeTimes.length };
  }
  upgradeTimes.push(now);
  return { allowed: true, current: upgradeTimes.length };
}
