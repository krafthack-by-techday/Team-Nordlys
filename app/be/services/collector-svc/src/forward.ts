import type {
  EventIngestInput,
  IndicatorIngestInput,
} from "@nordlys/contracts";
import { config } from "./config";

// All persistence flows through core-svc — collector-svc never writes to
// events/indicators directly. Returns the signed object on success.

export async function forwardEvent(
  input: EventIngestInput,
): Promise<{ id: string } | { error: string; status: number }> {
  const res = await fetch(`${config.coreSvcUrl}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return {
      error: `core-svc /events ${res.status}`,
      status: res.status,
    };
  }
  return (await res.json()) as { id: string };
}

export async function forwardIndicator(
  input: IndicatorIngestInput,
): Promise<{ id: string } | { error: string; status: number }> {
  const res = await fetch(`${config.coreSvcUrl}/indicators`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return {
      error: `core-svc /indicators ${res.status}`,
      status: res.status,
    };
  }
  return (await res.json()) as { id: string };
}
