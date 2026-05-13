import { config } from "./config";
import { reapIdleSessions } from "./connections";

let timer: ReturnType<typeof setInterval> | null = null;

export function startHealthCheck(): void {
  console.log(
    `[varde-svc] health-check: idle-timeout=${config.sessionIdleTimeoutMs}ms, sweep=${config.healthCheckIntervalMs}ms`,
  );
  timer = setInterval(() => {
    const reaped = reapIdleSessions(config.sessionIdleTimeoutMs);
    if (reaped > 0) {
      console.log(`[varde-svc] reaped ${reaped} idle sessions`);
    }
  }, config.healthCheckIntervalMs);
}

export function stopHealthCheck(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
