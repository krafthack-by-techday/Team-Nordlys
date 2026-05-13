# ADR-0024: Direct delivery with envelope encryption for TLP:RED

**Status**: Proposed — depends on ADR-0020, ADR-0023
**Date**: 2026-05-11
**Deciders**: (leave blank — to be filled by team)

## Context

ADR-0023 replaces flat all-to-all gossip with bounded gossip
(random-k or Plumtree). Bounded gossip is efficient for broadcast
distribution (GREEN, CLEAR, AMBER without recipients) but creates a
problem for TLP:RED and AMBER-with-recipients objects: how do these
reach only their named recipients without traversing non-recipient
Vardes?

In the flat model, every Varde gossiped directly with every other
Varde, so the responding Varde could simply filter RED objects from
gossip responses to non-recipients. With bounded gossip, a Varde
gossips with only ~15 peers — the recipient Varde may not be among
them. Multi-hop gossip would require intermediate (non-recipient)
Vardes to relay RED objects they are not entitled to see.

This ADR specifies a **separate delivery channel** for
recipient-restricted objects. The separation is motivated by three
findings from protocol research:

1. **Broadcast and targeted delivery have opposed optimisation
   targets.** Broadcast optimises for robustness and convergence
   across all nodes. Targeted delivery optimises for secrecy and
   minimal involvement of non-recipients. No single protocol handles
   both well (Banerjee et al. 2002, Chu et al. 2000).

2. **MISP's failure mode.** MISP relies on policy-based routing
   (sharing groups, distribution levels) without cryptographic
   enforcement. Its most common failure is silent oversharing due to
   misconfigured sync rules. Nordlys must add a cryptographic layer
   so that even a routing failure cannot expose RED content.

3. **SSB's private-box pattern.** Secure Scuttlebutt encrypts private
   messages with a per-message symmetric key, then encrypts that key
   for each recipient using X25519 key agreement. This provides
   confidentiality even if the message reaches unintended nodes. The
   7-slot padding hides the number of recipients.

The design combines **routing** (send only to recipient Vardes) with
**encryption** (content is protected even if routing fails) — the
hybrid approach that research identifies as most robust.

## Decision

### 1. Separation of channels

Nordlys uses two distinct delivery channels:

| Channel | Objects | Mechanism | Specified in |
|---|---|---|---|
| Gossip | GREEN, CLEAR, AMBER (no recipients) | Bounded gossip (push + pull) | ADR-0023 |
| Direct | RED, AMBER (with recipients) | HTTP POST to recipient Vardes + envelope encryption | This ADR |

The gossip layer **never** carries objects with a non-empty
`recipients` field. The direct channel **never** carries objects
without a `recipients` field. This invariant is enforced at the
boundary between core-svc and mesh-svc (outbound) and at the Varde
inbound endpoint (inbound).

### 2. Direct delivery mechanism

When core-svc produces a signed object with `tlp=RED` or
`tlp=AMBER` and a non-empty `recipients` field:

1. Core-svc signs the object as normal (Ed25519 over JCS canonical
   form).
2. Core-svc encrypts the signed object into a sealed envelope
   (§3 below).
3. Core-svc passes the sealed envelope to mesh-svc with the
   recipient list.
4. Mesh-svc resolves each recipient `node_id` to its Varde URL
   via the roster.
5. Mesh-svc delivers the sealed envelope to each recipient Varde
   via `POST /v1/private/deliver`.
6. The recipient Varde forwards the sealed envelope to its connected
   node via the existing WebSocket tunnel.
7. The recipient node's core-svc decrypts, verifies the inner
   signature, and stores.

Delivery is **parallel** — mesh-svc POSTs to all recipient Vardes
concurrently. For a typical RED object with 3 recipients, this is 3
HTTP requests total.

### 3. Envelope encryption (SSB private-box inspired)

The sealed envelope protects confidentiality even if an envelope
reaches an unintended recipient (routing bug, compromised Varde,
intercepted traffic).

**Encryption (sender, core-svc):**

```
Input: signed_object (bytes), recipients (list of Ed25519 public keys)

1. Generate ephemeral X25519 keypair (eph_sk, eph_pk)
2. Generate random 32-byte message key K
3. Encrypt signed_object with K using XChaCha20-Poly1305:
     ciphertext = encrypt(K, nonce, signed_object)
4. For each recipient R (Ed25519 public key):
     a. Convert R to X25519: R_x25519 = ed25519_pk_to_x25519(R)
     b. Compute shared secret: ss = x25519(eph_sk, R_x25519)
     c. Derive slot key: slot_key = HKDF(ss, "nordlys-private-v1")
     d. Encrypt K with slot_key: slot[i] = encrypt(slot_key, K)
5. Pad slot array to MAX_RECIPIENTS (7) with random 48-byte values
6. Assemble envelope:
     {
       "version": 1,
       "ephemeral_pk": eph_pk,       // 32 bytes, X25519
       "slots": [slot[0], ..., slot[6]],  // 7 × 48 bytes
       "ciphertext": ciphertext,
       "nonce": nonce                // 24 bytes
     }
7. Discard eph_sk (ephemeral, never stored)
```

**Decryption (recipient, core-svc):**

```
Input: envelope, own Ed25519 keypair (sk, pk)

1. Convert own sk to X25519: my_x25519_sk = ed25519_sk_to_x25519(sk)
2. Compute shared secret: ss = x25519(my_x25519_sk, envelope.ephemeral_pk)
3. Derive slot key: slot_key = HKDF(ss, "nordlys-private-v1")
4. Try to decrypt each slot:
     for slot in envelope.slots:
       K = try_decrypt(slot_key, slot)
       if K is valid (AEAD tag verifies):
         break
5. If no slot decrypts: reject (not a recipient)
6. Decrypt ciphertext with K: signed_object = decrypt(K, nonce, ciphertext)
7. Verify Ed25519 signature on signed_object (standard verification)
8. Extract TLP and recipients from signed payload
9. Verify own node_id is in recipients (defence-in-depth)
10. Store
```

**Properties:**
- **Confidentiality:** Only named recipients can decrypt.
- **Recipient hiding:** All envelopes have exactly 7 slots. An
  observer cannot determine how many actual recipients there are
  (2? 5? 7?).
- **Forward secrecy (sender-side):** The ephemeral key is discarded
  after encryption. A future compromise of a recipient's long-term
  key does not retroactively expose past messages — the attacker
  would also need the ephemeral key, which no longer exists. Note:
  this does not protect against compromise that occurs *during*
  the encryption session itself.
- **No key pre-distribution:** Uses existing Ed25519 keys from the
  identity register. No additional key exchange protocol needed.
- **Standard cryptography:** Ed25519→X25519 conversion, XChaCha20-
  Poly1305, HKDF. All available in libsodium/NaCl and Go's
  standard library.

### 4. Maximum recipients

The slot count is fixed at 7, following SSB's private-box model.
This imposes a hard limit: a single RED object can have at most 7
named recipients.

For AMBER-with-recipients (which may address larger groups, up to
~50 organisations), two options:

- **Groups ≤ 7:** Use the same envelope format.
- **Groups 8–50:** Use multiple envelopes with non-overlapping slot
  assignments. The ciphertext is identical across envelopes (same K);
  only the slot arrays differ. Each envelope carries slots for up to
  7 recipients. For 20 recipients: 3 envelopes (7+7+6), all
  delivered in parallel.

The multiple-envelope approach does not leak group size to any single
recipient — each recipient sees one envelope with 7 slots and cannot
determine whether other envelopes were sent to other recipients.

### 5. Offline recipients and retry

If a recipient Varde is unreachable during delivery:

1. Mesh-svc retries with exponential backoff (1s, 2s, 4s, ... up to
   60s, max 10 retries over ~17 minutes).
2. If all retries fail, the envelope is persisted in a local
   `pending_delivery` queue with a TTL (default: 24 hours).
3. When the recipient Varde becomes reachable (detected via roster
   health or successful gossip contact), queued envelopes are
   delivered.
4. After TTL expiry, undelivered envelopes are dropped and an audit
   alert is logged.

The sender does NOT ask other recipients to relay on behalf of the
offline recipient. This would require revealing recipient identity
to the relaying peer. Instead, delivery responsibility remains with
the sender.

### 6. Varde behaviour for direct delivery

The recipient Varde's role in direct delivery is minimal:

1. Accept `POST /v1/private/deliver` from any authenticated Varde
   (verified by Varde-to-Varde mTLS or the existing peer
   authentication mechanism).
2. **Do not decrypt.** The Varde holds no private keys (Tenet 13).
3. **Do not store long-term.** The envelope is forwarded to the
   connected node via WebSocket and then discarded. If the node is
   temporarily disconnected, the Varde buffers the envelope in memory
   (bounded buffer, default 1000 envelopes) until the node reconnects
   and receives it via RESYNC-like replay.
4. **Do not include in gossip responses.** Private envelopes are never
   returned by `/v1/events/since/{cursor}`.

The Varde is a **mailbox**, not a participant in the cryptographic
protocol.

### 7. Sender authentication

The recipient Varde must verify that the delivering Varde is a
legitimate member of the mesh (not an arbitrary internet host
attempting to deliver forged envelopes). This is handled by the
existing Varde-to-Varde authentication mechanism (mTLS with
certificates from the identity register, or HMAC-authenticated
requests using shared roster secrets — to be specified by the
implementation team).

The recipient Varde does NOT verify that the sender is entitled to
send to this recipient — it cannot, because the envelope is
encrypted and the recipient list is hidden. Authorisation is
verified by the recipient core-svc after decryption (step 9 in §3).

### 8. Audit trail

| Event | Logged at | Fields |
|---|---|---|
| Envelope created | Sender core-svc | object_id, tlp, recipient_count (not identities), timestamp |
| Envelope delivered | Sender mesh-svc | object_id, destination_varde, delivery_time, attempt_count |
| Delivery failed (all retries exhausted) | Sender mesh-svc | object_id, destination_varde, reason, severity=alert |
| Envelope received | Recipient Varde | envelope_hash, source_varde, timestamp |
| Envelope decrypted | Recipient core-svc | object_id, sender_node_id, tlp, timestamp |
| Decryption failed (not a recipient) | Recipient core-svc | envelope_hash, reason, severity=warning |

Delivery failures are logged at alert severity — they may indicate
a partitioned peer that is missing time-critical RED intelligence.

## Consequences

- **RED objects never traverse non-recipient infrastructure.**
  Unlike gossip (where messages pass through intermediate nodes),
  direct delivery sends envelopes exclusively to recipient Vardes.
  Non-recipients never see the envelope, the ciphertext, or any
  metadata about its existence.

- **Defence in depth for RED confidentiality.** Even if routing fails
  (envelope delivered to wrong Varde due to stale roster), the
  content is encrypted and only named recipients can decrypt. A
  routing bug leaks ciphertext, not plaintext.

- **Existing Ed25519 keys are sufficient.** No new key distribution
  infrastructure is needed. The Ed25519→X25519 conversion is
  standard and supported by all major cryptographic libraries.

- **The gossip topology is independent of RED delivery.** ADR-0023's
  gossip parameter choices (fanout, strategy) do not affect RED
  delivery. The two channels are fully decoupled.

- **Latency for RED is lower than gossip.** Direct delivery is 1 hop
  (sender Varde → recipient Varde → recipient node). Gossip takes
  3-5 rounds. RED material — typically the most time-critical — is
  delivered faster than broadcast material.

- **Maximum 7 recipients per envelope.** This is a deliberate
  constraint. TLP:RED is defined as "named individual recipients
  only" — groups of 50 are not the RED use case. AMBER-with-
  recipients supports up to ~50 via multiple envelopes.

- **Offline recipients may miss time-critical RED material.** The
  24-hour retry window is a pragmatic choice. If a recipient is
  offline for longer, the RED material expires undelivered. This is
  operationally correct — RED material that is 24 hours stale has
  likely been superseded or re-shared through other channels.

- **Sender is the single point of delivery.** If the sender goes
  offline after encrypting but before delivering, the message is
  lost until the sender recovers. There is no "store and forward
  through the mesh" for RED — by design, because that would require
  non-recipients to handle the envelope.

## Alternatives considered

- **Gossip with filtering (original flat model).** Include RED
  objects in gossip responses only to recipient Vardes. Works with
  flat all-to-all but fails with bounded gossip (recipient may not
  be a gossip peer). No cryptographic protection — a filter bug
  leaks plaintext. Rejected because it couples RED delivery to
  gossip topology and lacks defence in depth.

- **Gossip encrypted blobs to all (SSB model).** Encrypt RED objects
  and include them in normal gossip. Every Varde stores and relays
  the ciphertext; only recipients can decrypt. Rejected because it
  leaks metadata (all 400 Vardes see that a RED object exists, its
  size, timing, and sender), wastes storage (395 Vardes store blobs
  they can never read), and violates the principle that non-
  recipients should not learn RED objects exist.

- **Rendezvous-point based delivery.** Designate a coordinator Varde
  that receives all private envelopes and distributes to recipients.
  Reduces sender fan-out to 1. Rejected because the coordinator
  becomes a metadata honeypot (sees all private traffic patterns),
  a single point of failure, and contradicts the decentralised
  trust model.

- **Onion-routed delivery through intermediate Vardes.** Source
  wraps the envelope in multiple encryption layers, each layer
  addressed to the next relay, hiding the final destination from
  intermediate hops. Maximum metadata protection. Rejected for v1.x
  because (a) 400 known organisations sharing threat intel have
  limited need to hide who is communicating with whom, (b) the
  implementation complexity (onion routing, path selection, relay
  protocols) is very high, and (c) the latency penalty of multi-hop
  delivery is undesirable for time-critical RED material.

- **Encryption only, no routing separation.** Encrypt RED objects
  but include them in gossip like any other object (the SSB
  approach). Non-recipients receive ciphertext. Rejected for the
  same reasons as "gossip encrypted blobs" above — metadata leakage
  and storage waste.

## Open Questions

### Group A — cryptographic choices

- Should the envelope use XChaCha20-Poly1305 (NaCl secretbox) or
  AES-256-GCM? XChaCha20 has a larger nonce (less collision risk
  with random nonces) and is NaCl's default. AES-GCM has hardware
  acceleration on most platforms. Performance difference is
  negligible at message sizes ≤10KB.
- Should the HKDF context string include the sender's node_id to
  bind the shared secret to the sender's identity? (Expected: yes.)
- Is 7 the right maximum slot count? FIRST TLP v2.0 defines RED as
  "individual recipients" — 7 may be generous. But AMBER-with-
  recipients may need more. Should the two levels use different
  envelope formats?

### Group B — Varde-to-Varde authentication for direct delivery

- What authenticates the delivering Varde? mTLS with identity-
  register-issued certificates is the strongest option. HMAC over
  the request body using a shared secret from the roster is simpler.
  The threat model for the `/v1/private/deliver` endpoint needs
  explicit specification.

### Group C — interaction with RESYNC

- If a node was offline when its Varde received a private envelope,
  should the Varde replay it on reconnect (RESYNC-like)? Or must
  the sender re-deliver? (Expected: Varde buffers and replays, since
  the sender has no way to know the recipient node was disconnected
  from its own Varde.)

### Group D — key rotation

- Ed25519 keys are long-lived (node identity). The X25519 keys
  derived from them are therefore also long-lived. Should Nordlys
  support ephemeral encryption keys (rotated periodically) for
  stronger forward secrecy? This would require a key distribution
  mechanism (publish current encryption key in the identity
  register, with versioning).

## References

- `docs/design-tenets.md` (Tenet 1, Tenet 3, Tenet 10, Tenet 13)
- ADR-0020 (TLP v2.0 enforcement architecture) — TLP invariants,
  defence-in-depth layers
- ADR-0023 (Bounded gossip topology) — the broadcast channel that
  this ADR complements
- FIRST Traffic Light Protocol v2.0,
  `https://www.first.org/tlp/` — RED requires named individual
  recipients
- Tarr, Lavoie, Tschudin (2019), "SSB Private Messages" — the
  private-box construction
- Bernstein (2005), "Curve25519" — X25519 key agreement
- Bernstein (2008), "ChaCha20 and Poly1305" — AEAD construction
