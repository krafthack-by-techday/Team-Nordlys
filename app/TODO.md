# TODO — Backend & Security

Outstanding work to support the new setup wizard and mesh onboarding flow.

---

## Context: The Onboarding Flow

### How it works end-to-end

1. **User deploys a Nordlys node** (Docker container). The node starts with no identity.
2. **Setup wizard** (frontend, 4 steps):
   - User enters their **company name** (e.g. "Statnett SF") and a **node name** (e.g. "soc")
   - These are combined into an immutable **node-id slug**: `statnett-sf-soc`
   - User creates an admin account (name, email, password)
   - User verifies physical access to the server via a CLI command
   - The wizard generates a **signed access request** (contains node_id, company, public key, contact info)
3. **Out-of-band delivery**: User copies the access request and sends it to their contact at KraftCERT via a secure channel (Signal, encrypted email, etc.)
4. **KraftCERT approves**: The KraftCERT operator pastes the access request into their node, which verifies the signature, creates an invite token bound to the company, and returns it.
5. **Out-of-band delivery back**: KraftCERT sends the invite token back to the user via the same secure channel.
6. **User redeems invite**: In the app under *Innstillinger → Mesh*, the user pastes the invite token. The node connects to the mesh via Varde (relay), the token is validated by KraftCERT's core-svc, and a signed peer identity is issued.
7. **Node is now part of the mesh**: Gossip, events, vulnerability sharing, and topology visibility are active.

### Key design decisions

- **Company and node name are immutable** — they form the node's permanent identity in the mesh. Cannot be changed after setup.
- **NODE_ID is generated during setup** — no longer requires a pre-configured environment variable for peer nodes. The slug (`statnett-sf-soc`) becomes the `node_id`.
- **Keypair is generated during setup** — Ed25519 keypair created and persisted at setup time. No more ephemeral keys.
- **The access request is signed** — proves the node owns the public key it claims, even though delivery is out-of-band.
- **Slug collisions are handled by KraftCERT** — if two nodes try to register with the same slug, KraftCERT rejects the duplicate.
- **Local functionality works immediately** — after setup, the user can log in and use local features (scanning, events, analysis). Only mesh communication requires KraftCERT approval.
- **All errors are user-friendly** — backend error codes are never shown raw. Frontend maps them to Norwegian messages.

### Architecture

- **BFF proxy**: All frontend API calls go through SvelteKit's `[...path]/+server.ts` catch-all proxy → Elysia backend at `CORE_API_URL`
- **Identity**: Ed25519 keypair (via `@nordlys/crypto`). No X.509/TLS certificates for identity (pure Ed25519 signatures).
- **Trust anchor**: KraftCERT is the sole trust anchor. All peer identities are signed by KraftCERT's private key.
- **Mesh relay**: Varde (WebSocket relay) brokers connections. Nodes don't connect directly to each other.

---

## ✅ COMPLETED

### Convention: No raw error codes in UI
- Shared `$lib/utils/errors.ts` with `mapError()` — all frontend pages use it.

### Backend: Setup generates NODE_ID from slug
- `be/services/api-gateway/src/routes/setup.ts` — accepts `company` + `nodeName`, generates slug, persists to `node_settings`
- `be/services/core-svc/src/config.ts` — `NODE_ID` and `COMPANY` env vars are optional, falls back to DB
- `be/services/mesh-svc/src/config.ts` — same fallback logic

### Backend: Keypair generation during setup
- Setup route generates Ed25519 keypair and writes to `/data/nordlys/keys/`
- `be/services/core-svc/src/keystore.ts` — reads from env → filesystem → ephemeral (dev)
- Public key stored in `node_settings` table

### Backend: `POST /v1/access-request` handler
- `be/services/core-svc/src/routes/access-request.ts` — reads node_id, company, public_key from config/keystore, signs payload
- `be/services/api-gateway/src/routes/access-request.ts` — proxy to core-svc (no auth required during setup)

### Backend: Company + node_name immutability
- `setImmutable()` helper in setup route checks for existing keys before writing

### Contracts: AccessRequest type + shared slugify()
- `be/packages/contracts/src/access-request.ts` — TypeBox schema
- `be/packages/contracts/src/slugify.ts` — shared utility
- Exported from `@nordlys/contracts`

### UX: Mesh-disconnected banner
- `frontend/src/routes/+layout.svelte` — persistent warning banner when mesh is not connected

### KraftCERT side: Accept access requests
- `POST /access-requests/approve` in `be/services/core-svc/src/routes/identity.ts`
- Verifies signature against embedded public key
- Creates invite token bound to declared company

---

## 🔲 REMAINING (non-blocking, future work)

### Security: Private key storage improvements

**Current:** Filesystem at `/data/nordlys/keys/` (plaintext, mode 0600)

**Improvements needed:**
1. Short-term: Mount keys via Docker secrets (read-only tmpfs)
2. Medium-term: Encrypt at rest with a passphrase derived from a hardware-bound secret
3. Long-term: HSM integration (e.g. PKCS#11) for environments that require it

### Security: SSL/TLS certificate renewals

**Status:** No automated certificate renewal mechanism exists.

**What's needed:**
- Automated cert provisioning for node-to-node TLS (mesh communication)
- Options:
  - Internal CA operated by KraftCERT (issue short-lived certs as part of onboarding)
  - ACME/Let's Encrypt for public-facing endpoints
  - Mutual TLS with the Ed25519 identity keys (avoids separate PKI entirely)
- Certificate rotation without downtime (graceful reload)
- Monitoring/alerting for upcoming expiration

### UX: KraftCERT approve UI

The `POST /access-requests/approve` endpoint exists but there's no frontend UI for KraftCERT operators to paste and approve access requests. Currently CLI/API only.

### Frontend: Import slugify from @nordlys/contracts

The frontend currently inlines its own `slugify()` in `+page.svelte`. Consider importing from the shared package for guaranteed consistency (requires adding `@nordlys/contracts` as a frontend dependency or extracting to a shared isomorphic package).
