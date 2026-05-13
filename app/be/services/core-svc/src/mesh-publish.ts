import { config } from "./config";
import { getDbInstance } from "./db";
import { touchLastSeen } from "./repos/peers";

// Best-effort fan-out to mesh-svc. Failures are logged but not propagated —
// the signed object is already persisted locally; mesh-svc will pick it up
// later via RESYNC if the publish missed.
//
// On successful publish we update our own last_seen_at so the topology view
// reflects that this node is actively participating in the mesh.
async function publish(path: string, body: unknown): Promise<void> {
  if (!config.meshSvcUrl) return;
  try {
    const res = await fetch(`${config.meshSvcUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        `[core-svc] mesh-svc ${path} ${res.status}: ${text.slice(0, 200)}`,
      );
      return;
    }
    // Successful mesh publish — touch our own heartbeat
    touchLastSeen(getDbInstance(), config.nodeId).catch(() => {});
  } catch (err) {
    console.warn(`[core-svc] mesh-svc ${path} failed:`, err);
  }
}

export const publishEvent = (event: unknown) =>
  publish("/publish/event", event);

export const publishIndicator = (indicator: unknown) =>
  publish("/publish/indicator", indicator);

export const publishChat = (chat: unknown) =>
  publish("/publish/chat", chat);
