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
