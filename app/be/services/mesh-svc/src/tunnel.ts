import type { ClientMsg, ServerMsg } from "@nordlys/ws-protocol";
import { config } from "./config";
import { handleServerMsg } from "./inbound";
import type { VardeCandidate } from "./rendezvous";
import { healthTracker } from "./health";

// One Tunnel manages a persistent outgoing WebSocket to a single Varde with
// reconnect, exponential backoff + jitter, HELLO-on-open, and PING liveness.
// Tunnels are restarted (`stop()` + new instance) whenever the chosen
// rendezvous slot rotates to a different Varde.

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

export class Tunnel {
  private ws: WebSocket | null = null;
  private outboundSeq = 0;
  private stopped = false;
  private retryCount = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  /** Pending PINGs awaiting PONG — maps seq → send timestamp. */
  private pendingPings = new Map<number, number>();
  private pongTimeouts = new Map<number, ReturnType<typeof setTimeout>>();

  constructor(public readonly varde: VardeCandidate) {}

  get key(): string {
    return `${this.varde.varde_id}@${this.varde.url}`;
  }

  get isOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  start(): void {
    if (this.stopped) return;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.clearPing();
    if (this.ws) {
      try {
        this.ws.close(1000, "tunnel_stop");
      } catch {
        // ignore — socket may already be closed
      }
      this.ws = null;
    }
  }

  send(msg: DistributiveOmit<ClientMsg, "seq">): boolean {
    if (!this.isOpen) return false;
    this.outboundSeq++;
    const full = { ...msg, seq: this.outboundSeq } as ClientMsg;
    try {
      this.ws!.send(JSON.stringify(full));
      return true;
    } catch (err) {
      console.warn(`[mesh-svc] send to ${this.key} failed:`, err);
      return false;
    }
  }

  private connect(): void {
    if (this.stopped) return;
    let socket: WebSocket;
    try {
      // Normalize URL: ensure ws(s):// protocol and /ws path
      let url = this.varde.url;
      if (url.startsWith("http://")) url = "ws://" + url.slice(7);
      else if (url.startsWith("https://")) url = "wss://" + url.slice(8);
      if (!url.endsWith("/ws")) url = url.replace(/\/?$/, "/ws");
      socket = new WebSocket(url);
    } catch (err) {
      console.warn(`[mesh-svc] tunnel ${this.key} construct failed:`, err);
      this.scheduleReconnect();
      return;
    }
    this.ws = socket;

    socket.addEventListener("open", () => {
      console.log(`[mesh-svc] tunnel ${this.key} OPEN`);
      this.retryCount = 0;
      healthTracker.recordReconnect(this.varde.varde_id);
      this.sendHello();
      this.startPing();
    });

    socket.addEventListener("message", (ev) => {
      void this.handleIncoming(ev.data);
    });

    socket.addEventListener("close", (ev) => {
      console.log(
        `[mesh-svc] tunnel ${this.key} CLOSE code=${ev.code} reason="${ev.reason}"`,
      );
      this.clearPing();
      this.clearPendingPings();
      healthTracker.recordDisconnect(this.varde.varde_id);
      this.ws = null;
      this.scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      // close handler will run too — let it drive reconnect.
    });
  }

  private async handleIncoming(data: unknown): Promise<void> {
    try {
      const text =
        typeof data === "string"
          ? data
          : data instanceof ArrayBuffer
            ? new TextDecoder().decode(data)
            : data instanceof Uint8Array
              ? new TextDecoder().decode(data)
              : String(data);
      const msg = JSON.parse(text) as ServerMsg;
      await handleServerMsg(this, msg);
    } catch (err) {
      console.warn(`[mesh-svc] failed to handle frame from ${this.key}:`, err);
    }
  }

  // After WELCOME, mesh-svc asks the Varde to replay anything we missed
  // since the last event we persisted locally.
  async sendResync(): Promise<void> {
    let cursor = new Date(0).toISOString();
    try {
      const res = await fetch(`${config.coreSvcUrl}/last-event-cursor`);
      if (res.ok) {
        const body = (await res.json()) as { cursor?: string };
        if (body.cursor) cursor = body.cursor;
      }
    } catch (err) {
      console.warn(`[mesh-svc] /last-event-cursor lookup failed:`, err);
    }
    this.send({
      type: "RESYNC",
      from_cursor: cursor,
      channels: ["events", "indicators", "chat"],
    });
    console.log(`[mesh-svc] RESYNC sent on ${this.key} from=${cursor}`);
  }

  private sendHello(): void {
    // The cursor is fetched lazily when needed; for HELLO we can use 0.
    // RESYNC will catch up to the latest persisted event after WELCOME.
    this.send({
      type: "HELLO",
      node_id: config.nodeId,
      company: config.company,
      public_key: getPublicKeyForHello(),
    });
  }

  /** Called by inbound.ts when a PONG frame arrives. */
  handlePong(seq: number): void {
    const sendTime = this.pendingPings.get(seq);
    if (sendTime !== undefined) {
      const rtt = Date.now() - sendTime;
      this.pendingPings.delete(seq);
      const timeout = this.pongTimeouts.get(seq);
      if (timeout) { clearTimeout(timeout); this.pongTimeouts.delete(seq); }
      healthTracker.recordRtt(this.varde.varde_id, rtt);
    }
    // Also apply passive decay on each successful pong
    healthTracker.decay(this.varde.varde_id);
  }

  private startPing(): void {
    this.clearPing();
    this.pingTimer = setInterval(() => {
      this.outboundSeq++;
      const seq = this.outboundSeq;
      const full = { type: "PING", seq } as ClientMsg;
      try {
        this.ws!.send(JSON.stringify(full));
        this.pendingPings.set(seq, Date.now());
        // Set PONG timeout
        const timeout = setTimeout(() => {
          if (this.pendingPings.has(seq)) {
            this.pendingPings.delete(seq);
            this.pongTimeouts.delete(seq);
            healthTracker.recordPongTimeout(this.varde.varde_id);
          }
        }, config.healthPongTimeoutMs);
        this.pongTimeouts.set(seq, timeout);
      } catch {
        // Socket may be closing
      }
    }, config.pingIntervalMs);
  }

  private clearPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private clearPendingPings(): void {
    for (const t of this.pongTimeouts.values()) clearTimeout(t);
    this.pongTimeouts.clear();
    this.pendingPings.clear();
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    this.retryCount++;
    const base = Math.min(
      config.reconnectMaxMs,
      config.reconnectMinMs * 2 ** Math.min(this.retryCount, 6),
    );
    const jitter = Math.random() * base * 0.3;
    const delay = Math.floor(base + jitter);
    console.log(
      `[mesh-svc] tunnel ${this.key} reconnect in ${delay}ms (attempt ${this.retryCount})`,
    );
    setTimeout(() => this.connect(), delay);
  }
}

// The mesh-svc doesn't hold the node's private key — that's core-svc's job.
// For HELLO we ship the public key only, fetched once at startup from
// core-svc / its self-registered identity.
let cachedPublicKey: string | null = null;

export async function loadOwnPublicKey(): Promise<string> {
  if (cachedPublicKey) return cachedPublicKey;
  const res = await fetch(`${config.coreSvcUrl}/identities`);
  if (!res.ok) {
    throw new Error(`core-svc /identities ${res.status}`);
  }
  const peers = (await res.json()) as Array<{
    node_id: string;
    public_key: string;
  }>;
  const me = peers.find((p) => p.node_id === config.nodeId);
  if (!me) {
    throw new Error(`core-svc has no identity for ${config.nodeId} yet`);
  }
  cachedPublicKey = me.public_key;
  return cachedPublicKey;
}

function getPublicKeyForHello(): string {
  if (!cachedPublicKey) {
    throw new Error("public key not loaded; call loadOwnPublicKey() first");
  }
  return cachedPublicKey;
}
