from __future__ import annotations

import os
import threading
import time
import uuid
from datetime import datetime, timezone

from collections import defaultdict
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from db import init_db, get_db, seed_vulnerabilities, seed_indicators
from identity import (
    init_identity_db, create_invite, validate_invite,
    register_peer, get_all_peers, get_peer_identity, is_trusted,
    revoke_peer, is_revoked, get_revocations, add_revocation,
)

NODE_ID = os.environ.get("NODE_ID", "node-" + uuid.uuid4().hex[:6])
COMPANY = os.environ.get("COMPANY", NODE_ID)
PEERS = [p.strip() for p in os.environ.get("PEERS", "").split(",") if p.strip()]
ROLE = os.environ.get("ROLE", "peer")  # "kraftcert" or "peer"
VARDE = os.environ.get("VARDE_NAME", "")  # non-empty if behind a Varde relay

# Ingest API keys: comma-separated "name:secret" pairs (e.g. "kollektor-syslog:s3cret")
INGEST_KEYS_RAW = os.environ.get("INGEST_KEYS", "")
INGEST_KEYS: dict[str, str] = {}
for pair in INGEST_KEYS_RAW.split(","):
    pair = pair.strip()
    if ":" in pair:
        name, secret = pair.split(":", 1)
        INGEST_KEYS[secret.strip()] = name.strip()

VALID_SOURCES = {"manual", "syslog", "scada", "mqtt", "opcua", "iec104", "modbus", "dnp3", "custom"}
VALID_SEVERITIES = {"low", "medium", "high", "critical"}

# Per-scenario rate caps (events per hour, by severity).
SCENARIO_RATE_CAPS = {"low": 20, "medium": 10, "high": 5, "critical": 2}
_scenario_window: dict[tuple[str, str], list[float]] = defaultdict(list)
_scenario_lock = threading.Lock()
# How other nodes can reach us (docker service name derived from NODE_ID)
SELF_URL = os.environ.get("SELF_URL", f"http://{NODE_ID.rsplit('-', 1)[0]}:8000")
PUBLIC_URL = os.environ.get("PUBLIC_URL", "")  # URL reachable from outside (browser)

app = FastAPI(title=f"STK — {COMPANY}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Node's own key pair — generated at startup
_private_key = None
_public_key = None


@app.on_event("startup")
def startup():
    global _private_key, _public_key
    init_db()
    init_identity_db()
    seed_vulnerabilities()
    seed_indicators()

    from crypto import generate_keypair, get_public_key_pem
    _private_key, _public_key = generate_keypair()

    # Register ourselves
    register_peer(NODE_ID, COMPANY, get_public_key_pem(), registered_by="self", public_url=PUBLIC_URL)

    # Auto-register with KraftCERT if we have an invite token
    invite_token = os.environ.get("INVITE_TOKEN")
    kraftcert_url = os.environ.get("KRAFTCERT_URL")
    if invite_token and kraftcert_url:
        threading.Thread(
            target=_auto_register, args=(kraftcert_url, invite_token), daemon=True
        ).start()

    # Populate gossip peer set from identity DB (survives restarts)
    from gossip import add_peer
    for peer in get_all_peers():
        url = peer.get("public_url", "").strip().rstrip("/")
        if url and peer.get("node_id") != NODE_ID:
            add_peer(url)

    from gossip import start_gossip_loop
    start_gossip_loop()


def _auto_register(kraftcert_url: str, token: str):
    """Register this node with KraftCERT using an invite token."""
    import time
    import httpx
    from crypto import get_public_key_pem

    # Retry — KraftCERT might not be up yet
    for attempt in range(10):
        try:
            resp = httpx.post(f"{kraftcert_url}/register", json={
                "node_id": NODE_ID,
                "company": COMPANY,
                "public_key": get_public_key_pem(),
                "invite_token": token,
                "url": SELF_URL,
                "public_url": PUBLIC_URL,
            }, timeout=5)
            if resp.status_code == 201:
                import logging
                logging.getLogger("onboarding").info(
                    f"Registered with KraftCERT at {kraftcert_url}"
                )
                return
            else:
                import logging
                logging.getLogger("onboarding").warning(
                    f"Registration failed: {resp.status_code} {resp.text}"
                )
        except Exception:
            pass
        time.sleep(2)


# ── Models ──────────────────────────────────────────────────────────


class EventIn(BaseModel):
    title: str
    description: str = ""
    severity: str = "medium"  # low / medium / high / critical


class EventIngestIn(BaseModel):
    """Sent by a kollektor sidecar that has translated an OT signal into a STK event."""
    title: str
    description: str = ""
    severity: str = "medium"
    source: str = "syslog"
    external_ref: str = ""
    scenario_id: str = ""


class Event(BaseModel):
    id: str
    node_id: str
    company: str
    title: str
    description: str
    severity: str
    created_at: str
    signature: str = ""
    hops: int = 0
    source: str = "manual"
    external_ref: str = ""
    scenario_id: str = ""


class RegisterRequest(BaseModel):
    node_id: str
    company: str
    public_key: str
    invite_token: str
    url: str = ""
    public_url: str = ""


class InviteRequest(BaseModel):
    company: str
    ttl_seconds: int = 3600


class RevokeRequest(BaseModel):
    node_id: str
    reason: str = ""


# ── Gossip activity ────────────────────────────────────────────────


@app.get("/gossip/activity")
def gossip_activity(since: float = 0):
    """Return recent gossip activity for topology visualization."""
    from gossip import get_activity
    return {"node_id": NODE_ID, "activity": get_activity(since)}


# ── UI ──────────────────────────────────────────────────────────────


_STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


@app.get("/")
def ui_root():
    """STK-åpningsdashbord: viser de 7 komponentene som kort + live counters."""
    return FileResponse(os.path.join(_STATIC_DIR, "index.html"))


@app.get("/node")
def ui_node():
    """Detaljert per-node-visning med events, peer-helse og gossip-aktivitet."""
    return FileResponse(os.path.join(_STATIC_DIR, "node.html"))


@app.get("/topology")
def ui_topology():
    """Visualisert mesh-kart — force-directed Canvas med alle peers."""
    return FileResponse(os.path.join(_STATIC_DIR, "topology.html"))


@app.get("/topology/debug")
def ui_topology_debug():
    """Detaljert gossip-aktivitet på tvers av noder."""
    return FileResponse(os.path.join(_STATIC_DIR, "topology-debug.html"))


@app.get("/events/ui")
def ui_events():
    return FileResponse(os.path.join(_STATIC_DIR, "events.html"))


@app.get("/events/ui/detail")
def ui_event_detail():
    return FileResponse(os.path.join(_STATIC_DIR, "event-detail.html"))


@app.get("/indicators/ui")
def ui_indicators():
    return FileResponse(os.path.join(_STATIC_DIR, "indicators.html"))


@app.get("/vulnerabilities/ui")
def ui_vulnerabilities():
    return FileResponse(os.path.join(_STATIC_DIR, "vulnerabilities.html"))


@app.get("/chat/ui")
def ui_chat():
    return FileResponse(os.path.join(_STATIC_DIR, "chat.html"))


# ── Health & discovery ──────────────────────────────────────────────


_heartbeat: int = 0


@app.get("/stats")
def stats():
    """Aggregerte tellere for STK-åpningsdashbordet."""
    from gossip import get_peers, get_peer_health
    db = get_db()

    events_total = db.execute("SELECT COUNT(*) FROM events").fetchone()[0]
    events_24h = db.execute(
        "SELECT COUNT(*) FROM events WHERE created_at > datetime('now','-1 day')"
    ).fetchone()[0]
    events_critical_24h = db.execute(
        "SELECT COUNT(*) FROM events "
        "WHERE created_at > datetime('now','-1 day') "
        "AND severity IN ('high','critical')"
    ).fetchone()[0]

    health_map = get_peer_health()
    peers = get_peers()
    peers_online = sum(1 for u in peers if health_map.get(u, {}).get("status") == "online")

    all_peers = get_all_peers()
    peers_total = len(all_peers)

    return {
        "node_id": NODE_ID,
        "company": COMPANY,
        "role": ROLE,
        "events": {"total": events_total, "last_24h": events_24h, "critical_24h": events_critical_24h},
        "peers": {"online": peers_online, "total": peers_total},
        "vulnerabilities": {
            "open": db.execute("SELECT COUNT(*) FROM vulnerabilities WHERE status='open'").fetchone()[0],
            "critical": db.execute("SELECT COUNT(*) FROM vulnerabilities WHERE status='open' AND severity='critical'").fetchone()[0],
        },
        "indicators": {
            "total": db.execute("SELECT COUNT(*) FROM indicators").fetchone()[0],
            "tlp_red": db.execute("SELECT COUNT(*) FROM indicators WHERE tlp='RED'").fetchone()[0],
            "tlp_amber": db.execute("SELECT COUNT(*) FROM indicators WHERE tlp='AMBER'").fetchone()[0],
        },
        "incidents": {
            "open": db.execute("SELECT COUNT(*) FROM events WHERE severity IN ('critical','high')").fetchone()[0],
        },
        "tools": {"installed": 0},
    }


@app.get("/health")
def health():
    global _heartbeat
    _heartbeat += 1
    resp = {
        "status": "ok",
        "node_id": NODE_ID,
        "company": COMPANY,
        "role": ROLE,
        "heartbeat": _heartbeat,
    }
    if VARDE:
        resp["varde"] = VARDE
    return resp


@app.get("/.well-known/stk")
def well_known():
    from gossip import get_peers
    from crypto import get_public_key_pem
    resp = {
        "node_id": NODE_ID,
        "company": COMPANY,
        "public_key": get_public_key_pem(),
        "peers": get_peers(),
        "status": "online",
        "role": ROLE,
    }
    if VARDE:
        resp["varde"] = VARDE
    return resp


@app.get("/peers")
def list_peers():
    """Live peer list with health status."""
    from gossip import get_peers, get_peer_health
    health_map = get_peer_health()
    peers = []
    for url in get_peers():
        h = health_map.get(url, {})
        peers.append({
            "url": url,
            "status": h.get("status", "unknown"),
            "last_seen": h.get("last_seen", 0),
            "failures": h.get("consecutive_failures", 0),
        })
    return {"node_id": NODE_ID, "peers": peers}


# ── Identity & onboarding ──────────────────────────────────────────


@app.get("/identity")
def list_identities():
    """Return all known peer identities and revocations."""
    return {
        "node_id": NODE_ID,
        "peers": get_all_peers(),
        "revocations": get_revocations(),
    }


@app.post("/invite", status_code=201)
def create_invite_token(req: InviteRequest):
    """Generate an invite token for a new peer. KraftCERT only."""
    if ROLE != "kraftcert":
        raise HTTPException(403, detail="Only KraftCERT can issue invites")
    token = create_invite(req.company, req.ttl_seconds)
    return {"token": token, "company": req.company, "ttl_seconds": req.ttl_seconds}


@app.post("/register", status_code=201)
def register_node(req: RegisterRequest):
    """Register a new peer with an invite token. KraftCERT validates and stores."""
    if ROLE != "kraftcert":
        raise HTTPException(403, detail="Only KraftCERT accepts registrations")
    if not validate_invite(req.invite_token, req.company):
        raise HTTPException(401, detail="Invalid, expired, or already used invite token")

    register_peer(req.node_id, req.company, req.public_key, registered_by="kraftcert", public_url=req.public_url)

    # Add new peer's URL to gossip so we can announce it to others
    if req.url:
        from gossip import add_peer
        add_peer(req.url)

    # Distribute identity to all known peers via gossip
    from gossip import get_peers
    import httpx
    identity = {
        "node_id": req.node_id,
        "company": req.company,
        "public_key": req.public_key,
        "public_url": req.public_url,
    }
    for peer in get_peers():
        try:
            httpx.post(f"{peer}/identity/sync", json=[identity], timeout=3)
        except Exception:
            pass  # gossip will catch up

    return {"status": "registered", "node_id": req.node_id}


@app.post("/revoke", status_code=200)
def revoke_node(req: RevokeRequest):
    """Revoke a peer's trust. KraftCERT only."""
    if ROLE != "kraftcert":
        raise HTTPException(403, detail="Only KraftCERT can revoke peers")
    if not revoke_peer(req.node_id, req.reason):
        raise HTTPException(404, detail=f"Peer {req.node_id} not found")

    # Distribute revocation to all peers via gossip
    from gossip import get_peers
    import httpx
    revocation = {
        "node_id": req.node_id,
        "reason": req.reason,
    }
    for peer in get_peers():
        try:
            httpx.post(f"{peer}/identity/revoke-sync", json=[revocation], timeout=3)
        except Exception:
            pass
    return {"status": "revoked", "node_id": req.node_id}


@app.post("/identity/sync", status_code=200)
def sync_identities(identities: list[dict]):
    """Receive peer identities from gossip. New peers are added; for existing
    peers, only an empty public_url gets backfilled (other fields are immutable
    via gossip — re-registration goes through KraftCERT)."""
    added = 0
    for ident in identities:
        node_id = ident.get("node_id")
        if not node_id or is_revoked(node_id):
            continue
        existing = get_peer_identity(node_id)
        new_url = ident.get("public_url", "")
        if existing:
            if new_url and not existing.get("public_url"):
                register_peer(
                    node_id, existing["company"], existing["public_key"],
                    registered_by=existing.get("registered_by", "gossip"),
                    public_url=new_url,
                )
                added += 1
            continue
        register_peer(
            node_id, ident["company"], ident["public_key"],
            registered_by="gossip", public_url=new_url,
        )
        added += 1
    return {"added": added}


@app.post("/identity/revoke-sync", status_code=200)
def sync_revocations(revocations: list[dict]):
    """Receive revocations from gossip."""
    from datetime import datetime, timezone
    added = 0
    for rev in revocations:
        node_id = rev.get("node_id")
        if not node_id or is_revoked(node_id):
            continue
        # Look up company before revoking
        peer = get_peer_identity(node_id)
        company = peer["company"] if peer else rev.get("company", "unknown")
        add_revocation(
            node_id, company,
            rev.get("revoked_at", datetime.now(timezone.utc).isoformat()),
            rev.get("reason", ""),
        )
        added += 1
    return {"added": added}


# ── Events ──────────────────────────────────────────────────────────


def _persist_and_push(
    title: str, description: str, severity: str,
    source: str, external_ref: str, scenario_id: str,
) -> dict:
    """Shared persistence path for both manual and ingested events."""
    from crypto import sign_event
    from gossip import push_event, MAX_HOPS

    event_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    event_data = {
        "id": event_id, "node_id": NODE_ID, "company": COMPANY,
        "title": title, "description": description,
        "severity": severity, "created_at": now,
        "source": source, "external_ref": external_ref,
        "scenario_id": scenario_id,
    }
    signature = sign_event(_private_key, event_data)

    db = get_db()
    db.execute(
        """INSERT INTO events
           (id, node_id, company, title, description, severity, created_at,
            signature, source, external_ref, scenario_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (event_id, NODE_ID, COMPANY, title, description, severity, now,
         signature, source, external_ref, scenario_id),
    )
    db.commit()

    event_data["signature"] = signature
    event_data["hops"] = MAX_HOPS
    threading.Thread(target=push_event, args=(event_data,), daemon=True).start()
    return {"id": event_id, "node_id": NODE_ID, "created_at": now}


@app.post("/events", status_code=201)
def create_event(event_in: EventIn):
    if event_in.severity not in VALID_SEVERITIES:
        raise HTTPException(400, detail=f"Invalid severity: {event_in.severity}")
    return _persist_and_push(
        title=event_in.title, description=event_in.description,
        severity=event_in.severity,
        source="manual", external_ref="", scenario_id="",
    )


def _check_scenario_rate(source: str, scenario_id: str, severity: str) -> bool:
    """Return True if within per-(source, scenario_id) hourly cap. No scenario_id → no cap."""
    if not scenario_id:
        return True
    cap = SCENARIO_RATE_CAPS.get(severity, 10)
    key = (source, scenario_id)
    now = time.time()
    with _scenario_lock:
        window = [t for t in _scenario_window[key] if now - t < 3600]
        if len(window) >= cap:
            _scenario_window[key] = window
            return False
        window.append(now)
        _scenario_window[key] = window
        return True


@app.post("/events/ingest", status_code=201)
def ingest_event(payload: EventIngestIn, x_ingest_key: str = Header(default="")):
    """Receive a structured event from a local kollektor sidecar.

    Auth: shared secret in X-Ingest-Key header, configured via INGEST_KEYS env.
    The node signs the event with its own RSA key — kollektor is trusted *locally*
    to decide what becomes a STK event, but the gossip-layer signature chain
    still flows from the registered node identity.
    """
    if not INGEST_KEYS:
        raise HTTPException(503, detail="Ingest disabled (no INGEST_KEYS configured)")
    collector_name = INGEST_KEYS.get(x_ingest_key)
    if not collector_name:
        raise HTTPException(401, detail="Invalid or missing X-Ingest-Key")

    if payload.severity not in VALID_SEVERITIES:
        raise HTTPException(400, detail=f"Invalid severity: {payload.severity}")
    if payload.source not in VALID_SOURCES or payload.source == "manual":
        raise HTTPException(400, detail=f"Invalid source for ingest: {payload.source}")

    # Idempotent retry: same (source, external_ref) returns the existing record.
    if payload.external_ref:
        db = get_db()
        existing = db.execute(
            "SELECT id, created_at FROM events WHERE source = ? AND external_ref = ? LIMIT 1",
            (payload.source, payload.external_ref),
        ).fetchone()
        if existing:
            return {
                "id": existing["id"], "node_id": NODE_ID,
                "created_at": existing["created_at"], "deduplicated": True,
            }

    if not _check_scenario_rate(payload.source, payload.scenario_id, payload.severity):
        raise HTTPException(429, detail=f"Scenario rate cap reached for {payload.scenario_id}")

    import logging
    logging.getLogger("ingest").info(
        f"ingest from={collector_name} source={payload.source} "
        f"scenario={payload.scenario_id} severity={payload.severity}"
    )

    return _persist_and_push(
        title=payload.title, description=payload.description,
        severity=payload.severity,
        source=payload.source, external_ref=payload.external_ref,
        scenario_id=payload.scenario_id,
    )


@app.get("/events")
def list_events():
    db = get_db()
    rows = db.execute("SELECT * FROM events ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


@app.get("/events/since/{since}")
def events_since(since: str):
    """Return events created after the given ISO timestamp. Used by gossip pull."""
    db = get_db()
    rows = db.execute(
        "SELECT * FROM events WHERE created_at > ? ORDER BY created_at", (since,)
    ).fetchall()
    return [dict(r) for r in rows]


@app.post("/events/sync", status_code=201)
def sync_events(events: list[Event]):
    """Receive events from a peer. Verifies signature, deduplicates, and forwards."""
    from gossip import push_event, check_rate_limit
    from crypto import verify_signature

    db = get_db()
    new_events = []
    for e in events:
        if is_revoked(e.node_id):
            raise HTTPException(403, detail=f"Peer {e.node_id} has been revoked")
        if not check_rate_limit(e.node_id):
            raise HTTPException(429, detail=f"Rate limit exceeded for {e.node_id}")

        # Verify signature if we know this peer
        if e.signature:
            peer_ident = get_peer_identity(e.node_id)
            if peer_ident:
                event_data = {
                    "id": e.id, "node_id": e.node_id, "company": e.company,
                    "title": e.title, "description": e.description,
                    "severity": e.severity, "created_at": e.created_at,
                    "source": e.source, "external_ref": e.external_ref,
                    "scenario_id": e.scenario_id,
                }
                if not verify_signature(peer_ident["public_key"], event_data, e.signature):
                    raise HTTPException(403, detail=f"Invalid signature for event {e.id}")

        try:
            db.execute(
                """INSERT INTO events
                   (id, node_id, company, title, description, severity, created_at,
                    signature, source, external_ref, scenario_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (e.id, e.node_id, e.company, e.title, e.description,
                 e.severity, e.created_at, e.signature,
                 e.source, e.external_ref, e.scenario_id),
            )
            new_events.append(e.model_dump())
        except Exception:
            pass  # duplicate id
    db.commit()

    for ev in new_events:
        if ev.get("hops", 0) > 0:
            threading.Thread(target=push_event, args=(ev,), daemon=True).start()
    return {"inserted": len(new_events)}


# ── Indicators (IoC) ────────────────────────────────────────────────


class IndicatorIn(BaseModel):
    type: str = "ip"       # ip / hash / domain / ttp
    value: str
    tlp: str = "AMBER"     # RED / AMBER / GREEN / WHITE
    description: str = ""
    severity: str = "medium"


class Indicator(BaseModel):
    id: str
    node_id: str
    company: str
    type: str
    value: str
    tlp: str
    description: str
    severity: str
    created_at: str
    signature: str = ""
    hops: int = 0


@app.get("/indicators")
def list_indicators():
    db = get_db()
    rows = db.execute("SELECT * FROM indicators ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


@app.post("/indicators", status_code=201)
def create_indicator(ind: IndicatorIn):
    from crypto import sign_event
    from gossip import push_indicator, MAX_HOPS

    ind_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    data = {
        "id": ind_id, "node_id": NODE_ID, "company": COMPANY,
        "type": ind.type, "value": ind.value, "tlp": ind.tlp,
        "description": ind.description, "severity": ind.severity,
        "created_at": now,
    }
    signature = sign_event(_private_key, data)

    db = get_db()
    db.execute(
        """INSERT INTO indicators (id, node_id, company, type, value, tlp, description, severity, created_at, signature)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (ind_id, NODE_ID, COMPANY, ind.type, ind.value, ind.tlp,
         ind.description, ind.severity, now, signature),
    )
    db.commit()

    data["signature"] = signature
    data["hops"] = MAX_HOPS
    threading.Thread(target=push_indicator, args=(data,), daemon=True).start()
    return {"id": ind_id, "created_at": now}


@app.get("/indicators/since/{since}")
def indicators_since(since: str):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM indicators WHERE created_at > ? ORDER BY created_at", (since,)
    ).fetchall()
    return [dict(r) for r in rows]


@app.post("/indicators/sync", status_code=201)
def sync_indicators(indicators: list[Indicator]):
    from gossip import push_indicator
    db = get_db()
    new_count = 0
    for ind in indicators:
        try:
            db.execute(
                """INSERT INTO indicators (id, node_id, company, type, value, tlp, description, severity, created_at, signature)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (ind.id, ind.node_id, ind.company, ind.type, ind.value, ind.tlp,
                 ind.description, ind.severity, ind.created_at, ind.signature),
            )
            new_count += 1
            if ind.hops > 0:
                threading.Thread(target=push_indicator, args=(ind.model_dump(),), daemon=True).start()
        except Exception:
            pass  # duplicate
    db.commit()
    return {"inserted": new_count}


# ── Chat (per-event discussion) ─────────────────────────────────────


class ChatIn(BaseModel):
    author: str = ""
    message: str


class ChatMessage(BaseModel):
    id: str
    event_id: str
    node_id: str
    company: str
    author: str
    message: str
    created_at: str
    signature: str = ""
    hops: int = 0


@app.get("/events/{event_id}/chat")
def get_event_chat(event_id: str):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM chat_messages WHERE event_id = ? ORDER BY created_at ASC",
        (event_id,),
    ).fetchall()
    return [dict(r) for r in rows]


@app.post("/events/{event_id}/chat", status_code=201)
def post_event_chat(event_id: str, msg: ChatIn):
    from crypto import sign_event
    from gossip import push_chat, MAX_HOPS

    msg_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    data = {
        "id": msg_id, "event_id": event_id, "node_id": NODE_ID,
        "company": COMPANY, "author": msg.author or COMPANY,
        "message": msg.message, "created_at": now,
    }
    signature = sign_event(_private_key, data)

    db = get_db()
    db.execute(
        """INSERT INTO chat_messages (id, event_id, node_id, company, author, message, created_at, signature)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (msg_id, event_id, NODE_ID, COMPANY, msg.author or COMPANY, msg.message, now, signature),
    )
    db.commit()

    data["signature"] = signature
    data["hops"] = MAX_HOPS
    threading.Thread(target=push_chat, args=(data,), daemon=True).start()
    return {"id": msg_id, "created_at": now}


@app.get("/chat/since/{since}")
def chat_since(since: str):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM chat_messages WHERE created_at > ? ORDER BY created_at", (since,)
    ).fetchall()
    return [dict(r) for r in rows]


@app.post("/chat/sync", status_code=201)
def sync_chat(messages: list[ChatMessage]):
    from gossip import push_chat
    db = get_db()
    new_count = 0
    for m in messages:
        try:
            db.execute(
                """INSERT INTO chat_messages (id, event_id, node_id, company, author, message, created_at, signature)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (m.id, m.event_id, m.node_id, m.company, m.author, m.message, m.created_at, m.signature),
            )
            new_count += 1
            if m.hops > 0:
                threading.Thread(target=push_chat, args=(m.model_dump(),), daemon=True).start()
        except Exception:
            pass
    db.commit()
    return {"inserted": new_count}


# ── Vulnerabilities ─────────────────────────────────────────────────


@app.get("/vulnerabilities")
def list_vulnerabilities():
    db = get_db()
    rows = db.execute("SELECT * FROM vulnerabilities ORDER BY cvss_score DESC").fetchall()
    return [dict(r) for r in rows]


@app.get("/vulnerabilities/{vuln_id}")
def get_vulnerability(vuln_id: str):
    db = get_db()
    row = db.execute("SELECT * FROM vulnerabilities WHERE id = ?", (vuln_id,)).fetchone()
    if not row:
        raise HTTPException(404, detail="Vulnerability not found")
    return dict(row)


class VulnStatusUpdate(BaseModel):
    status: str  # open / in_progress / closed


@app.patch("/vulnerabilities/{vuln_id}")
def update_vulnerability_status(vuln_id: str, update: VulnStatusUpdate):
    if update.status not in ("open", "in_progress", "closed"):
        raise HTTPException(400, detail="Invalid status")
    db = get_db()
    db.execute("UPDATE vulnerabilities SET status = ? WHERE id = ?", (update.status, vuln_id))
    db.commit()
    return {"id": vuln_id, "status": update.status}
