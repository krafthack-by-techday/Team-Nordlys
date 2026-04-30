# Live Demo — Join the STK mesh

Set up your own peer node and connect it to an existing KraftCERT instance.

## Prerequisites

- Docker with Compose v2+
- An invite token (provided by the KraftCERT operator)

## Quick start

```bash
cp .env.example .env
# Edit .env with your values
chmod +x setup.sh
./setup.sh
```

The script will prompt you for the invite token and start your node.

## Configuration

| Variable | Description | Example |
|---|---|---|
| `PEER_NAME` | Your company name | `Statnett` |
| `KRAFTCERT_URL` | URL to the KraftCERT instance | `https://kraftcert.example.com` |
| `PEER_PUBLIC_URL` | Public URL for your node | `https://statnett.example.com` |
| `PEER_PORT` | Local port (default `8803`) | `8803` |

## What happens

1. You paste the invite token
2. The script builds and starts your peer node + a Varde frontend
3. Your node registers with KraftCERT and joins the mesh

The dashboard is available at `http://localhost:<PEER_PORT>`.

## Exposing your node publicly

Your node needs a public URL so other peers in the mesh can reach it. If you don't have a public server, you can use a tunnel service like [ngrok](https://ngrok.com), [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/), or [localhost.run](https://localhost.run).

Example with ngrok:

```bash
ngrok http 8803
```

Copy the generated URL (e.g. `https://abc123.ngrok-free.app`) and set it as `PEER_PUBLIC_URL` in your `.env` before running `setup.sh`.

> **Warning:** Many companies restrict or prohibit the use of tunnel services like ngrok on corporate networks. Check your organization's security policy before exposing any local services to the internet.

## Once your node is running

After registration your node is a full participant in the STK gossip mesh. Everything happens automatically.

### Peer discovery

Every 10 seconds your node crawls `/.well-known/stk` on all known peers to discover new nodes. As the mesh grows, your node learns about peers it was never explicitly told about.

### Gossip — push and pull

STK uses a push-pull gossip protocol to share three types of data:

- **Events** — security incidents, RSA-signed by the originating node
- **Indicators** — IoCs (IPs, hashes, domains, TTPs)
- **Chat** — per-event discussion between peers

**Push:** When any node creates new data it immediately pushes to all healthy peers. Each message carries a hop counter (default 3) that decrements on each relay, preventing infinite propagation.

**Pull:** Every sync cycle (10s) your node pulls `GET /events/since/{cursor}`, `/indicators/since/{cursor}`, and `/chat/since/{cursor}` from each peer, using persistent cursors to avoid re-fetching.

### Health tracking

Your node tracks consecutive failures per peer. After 3 failed attempts a peer is marked offline and excluded from push targets until it recovers.

### Trust and revocation

All events are RSA-signed and verified against the originating node's public key. KraftCERT can revoke trust for any peer — revoked nodes' events are rejected and their identities are skipped during sync.
