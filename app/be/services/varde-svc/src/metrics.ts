import { Counter, Gauge, Registry } from "@nordlys/metrics";

// Dedicated registry for varde-svc.
export const registry = new Registry();

/** Number of currently active WebSocket sessions. */
export const wsSessions = registry.register(
  new Gauge(
    "nordlys_varde_ws_sessions",
    "Number of active WebSocket sessions connected to this Varde.",
  ),
);

/** Total WS messages, labelled by type and direction (in/out). */
export const wsMessagesTotal = registry.register(
  new Counter(
    "nordlys_varde_ws_messages_total",
    "Total WebSocket messages processed, labelled by type and direction.",
  ),
);

/** Total events persisted to the local Postgres store (deduplicated inserts). */
export const eventsPersistedTotal = registry.register(
  new Counter(
    "nordlys_varde_events_persisted_total",
    "Total unique events inserted into the Varde local store.",
  ),
);

/** Peer gossip pull rounds, labelled by result (success/fail). */
export const peerGossipPullsTotal = registry.register(
  new Counter(
    "nordlys_varde_peer_gossip_pulls_total",
    "Total peer-gossip pull rounds, labelled by result.",
  ),
);

/** Partition management runs, labelled by result (success/fail). */
export const partitionManagementRunsTotal = registry.register(
  new Counter(
    "nordlys_varde_partition_management_runs_total",
    "Total partition management runs (ensureUpcomingPartitions), labelled by result.",
  ),
);
