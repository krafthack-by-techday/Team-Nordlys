/**
 * Signal types fed into the health score tracker.
 */

export type SignalType = "rtt" | "disconnect" | "delivery_latency" | "pong_timeout" | "reconnect";

export interface Signal {
  type: SignalType;
  /** Measurement value (ms for rtt/delivery_latency, count for disconnect). */
  value: number;
  timestamp: number;
}
