import { Counter, Histogram, Registry } from "@nordlys/metrics";

// Dedicated registry for api-gateway so the default registry isn't polluted
// by test imports in other packages.
export const registry = new Registry();

/** Total HTTP requests handled by the gateway. */
export const requestsTotal = registry.register(
  new Counter(
    "nordlys_gateway_requests_total",
    "Total HTTP requests handled by api-gateway, labelled by method, path and status.",
  ),
);

/** Request duration in seconds (histogram). */
export const requestDuration = registry.register(
  new Histogram(
    "nordlys_gateway_request_duration_seconds",
    "HTTP request duration in seconds, labelled by method and path.",
    [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  ),
);

/** Audit log writes to Postgres — tracks success/fail outcomes. */
export const auditWritesTotal = registry.register(
  new Counter(
    "nordlys_gateway_audit_writes_total",
    "Total audit log batch writes, labelled by outcome (success or fail).",
  ),
);
