"""Gossip protocol — push-pull with discovery, hop limiting, and peer health tracking."""

import os
import threading
import time
import logging
from collections import defaultdict

import httpx

from db import get_db

SEED_PEERS = [p.strip() for p in os.environ.get("PEERS", "").split(",") if p.strip()]
SYNC_INTERVAL = int(os.environ.get("SYNC_INTERVAL", "10"))
NODE_ID = os.environ.get("NODE_ID", "unknown")
MAX_HOPS = int(os.environ.get("MAX_HOPS", "3"))

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("gossip")

# ── Activity log ────────────────────────────────────────────────────
# Records real gossip activity for the topology visualization.

_activity_log: list[dict] = []
_activity_lock = threading.Lock()
_MAX_LOG = 100


def _log_activity(action: str, peer: str, detail: str = "", count: int = 0):
    """Record a gossip activity event."""
    entry = {
        "t": time.time(),
        "action": action,     # push | pull | discovery | push_fail | pull_fail
        "peer": peer,         # the remote peer URL involved
        "node_id": NODE_ID,   # this node
        "detail": detail,
        "count": count,
    }
    with _activity_lock:
        _activity_log.append(entry)
        if len(_activity_log) > _MAX_LOG:
            del _activity_log[:len(_activity_log) - _MAX_LOG]


def get_activity(since: float = 0) -> list[dict]:
    """Return activity entries after the given unix timestamp."""
    with _activity_lock:
        return [a for a in _activity_log if a["t"] > since]


# ── Peer registry ───────────────────────────────────────────────────

_peers: set[str] = set(SEED_PEERS)
_peers_lock = threading.Lock()

# Track peer health: url → {last_seen, consecutive_failures, status}
_peer_health: dict[str, dict] = {}
_health_lock = threading.Lock()
MAX_FAILURES = 3  # mark offline after this many consecutive failures


def get_peers() -> list[str]:
    with _peers_lock:
        return list(_peers)


def add_peer(url: str):
    """Add a peer URL to the gossip registry."""
    url = url.strip().rstrip("/")
    with _peers_lock:
        _peers.add(url)
    _mark_peer_ok(url)
    log.info(f"Added peer: {url}")


def get_peer_health() -> dict[str, dict]:
    with _health_lock:
        return dict(_peer_health)


def _mark_peer_ok(peer: str):
    with _health_lock:
        _peer_health[peer] = {
            "last_seen": time.time(),
            "consecutive_failures": 0,
            "status": "online",
        }


def _mark_peer_fail(peer: str):
    with _health_lock:
        info = _peer_health.get(peer, {"last_seen": 0, "consecutive_failures": 0, "status": "unknown"})
        info["consecutive_failures"] += 1
        info["status"] = "offline" if info["consecutive_failures"] >= MAX_FAILURES else "degraded"
        _peer_health[peer] = info


def _get_healthy_peers() -> list[str]:
    """Return peers that are not marked offline."""
    with _health_lock:
        offline = {p for p, h in _peer_health.items() if h.get("status") == "offline"}
    with _peers_lock:
        return [p for p in _peers if p not in offline]


# ── Rate limiting ───────────────────────────────────────────────────

_rate_window: dict[str, list[float]] = defaultdict(list)
_rate_lock = threading.Lock()
RATE_LIMIT = int(os.environ.get("RATE_LIMIT", "20"))  # max events per peer per minute


def check_rate_limit(peer_node_id: str) -> bool:
    """Return True if the peer is within rate limits."""
    now = time.time()
    with _rate_lock:
        window = _rate_window[peer_node_id]
        # Prune entries older than 60 seconds
        _rate_window[peer_node_id] = [t for t in window if now - t < 60]
        if len(_rate_window[peer_node_id]) >= RATE_LIMIT:
            return False
        _rate_window[peer_node_id].append(now)
        return True


# ── Discovery ───────────────────────────────────────────────────────


def _discover():
    """Crawl .well-known/stk on all known peers to find new ones."""
    with _peers_lock:
        to_crawl = list(_peers)

    discovered: set[str] = set()
    for peer in to_crawl:
        try:
            resp = httpx.get(f"{peer}/.well-known/stk", timeout=5)
            info = resp.json()
            _mark_peer_ok(peer)
            for new_peer in info.get("peers", []):
                new_peer = new_peer.strip().rstrip("/")
                if not new_peer:
                    continue
                with _peers_lock:
                    already_known = new_peer in _peers
                if already_known:
                    continue
                try:
                    check = httpx.get(f"{new_peer}/health", timeout=3)
                    if check.json().get("node_id") == NODE_ID:
                        continue  # it's us
                except Exception:
                    continue
                discovered.add(new_peer)
        except Exception:
            _mark_peer_fail(peer)

    if discovered:
        with _peers_lock:
            _peers.update(discovered)
        for p in discovered:
            _mark_peer_ok(p)
            _log_activity("discovery", p)
        log.info(f"Discovered new peers: {discovered}")


# ── Push ────────────────────────────────────────────────────────────


def push_event(event: dict, exclude: str | None = None):
    """Push a single event to healthy peers. Decrements hop count."""
    hops = event.get("hops", MAX_HOPS)
    if hops <= 0:
        return  # stop propagation

    event_with_hops = {**event, "hops": hops - 1}

    for peer in _get_healthy_peers():
        if peer == exclude:
            continue
        try:
            httpx.post(f"{peer}/events/sync", json=[event_with_hops], timeout=3)
            _mark_peer_ok(peer)
            _log_activity("push", peer, detail=event.get("title", ""), count=1)
        except Exception:
            _mark_peer_fail(peer)
            _log_activity("push_fail", peer)


def push_indicator(indicator: dict, exclude: str | None = None):
    """Push a single IoC to healthy peers."""
    hops = indicator.get("hops", MAX_HOPS)
    if hops <= 0:
        return
    data = {**indicator, "hops": hops - 1}
    for peer in _get_healthy_peers():
        if peer == exclude:
            continue
        try:
            httpx.post(f"{peer}/indicators/sync", json=[data], timeout=3)
            _mark_peer_ok(peer)
            _log_activity("push", peer, detail=f"IoC: {indicator.get('value','')}", count=1)
        except Exception:
            _mark_peer_fail(peer)


def push_chat(message: dict, exclude: str | None = None):
    """Push a chat message to healthy peers."""
    hops = message.get("hops", MAX_HOPS)
    if hops <= 0:
        return
    data = {**message, "hops": hops - 1}
    for peer in _get_healthy_peers():
        if peer == exclude:
            continue
        try:
            httpx.post(f"{peer}/chat/sync", json=[data], timeout=3)
            _mark_peer_ok(peer)
            _log_activity("push", peer, detail="chat", count=1)
        except Exception:
            _mark_peer_fail(peer)


# ── Pull (sync) ─────────────────────────────────────────────────────


def _last_seen_for_peer(peer: str) -> str:
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS sync_cursors (
            peer TEXT PRIMARY KEY,
            last_seen TEXT NOT NULL
        )
    """)
    row = db.execute("SELECT last_seen FROM sync_cursors WHERE peer = ?", (peer,)).fetchone()
    return row["last_seen"] if row else "1970-01-01T00:00:00"


def _update_cursor(peer: str, last_seen: str):
    db = get_db()
    db.execute(
        "INSERT OR REPLACE INTO sync_cursors (peer, last_seen) VALUES (?, ?)",
        (peer, last_seen),
    )
    db.commit()


def _sync_identities():
    """Pull peer identities and revocations from all known peers."""
    from identity import get_all_peers as get_local_identities, get_revocations, is_revoked

    local_by_id = {p["node_id"]: p for p in get_local_identities()}
    local_revocations = {r["node_id"] for r in get_revocations()}

    for peer in get_peers():
        try:
            resp = httpx.get(f"{peer}/identity", timeout=5)
            data = resp.json()

            # Sync new identities + backfill rows missing public_url.
            # The latter lets nodes upgrade existing identity rows when
            # the remote has fields (like public_url) we never received.
            remote_peers = data.get("peers", [])
            new_identities = []
            for p in remote_peers:
                if is_revoked(p["node_id"]):
                    continue
                local = local_by_id.get(p["node_id"])
                if local is None:
                    new_identities.append(p)
                elif p.get("public_url") and not local.get("public_url"):
                    new_identities.append(p)
            if new_identities:
                httpx.post("http://localhost:8000/identity/sync", json=new_identities, timeout=5)
                for p in new_identities:
                    local_by_id[p["node_id"]] = p
                _log_activity("pull_identity", peer, count=len(new_identities))
                log.info(f"Synced {len(new_identities)} identities from {peer}")

            # Sync revocations
            remote_revocations = data.get("revocations", [])
            new_revocations = [r for r in remote_revocations if r["node_id"] not in local_revocations]
            if new_revocations:
                httpx.post("http://localhost:8000/identity/revoke-sync", json=new_revocations, timeout=5)
                for r in new_revocations:
                    local_revocations.add(r["node_id"])
                _log_activity("pull_revocation", peer, count=len(new_revocations))
                log.info(f"Synced {len(new_revocations)} revocations from {peer}")
        except Exception:
            pass


def _sync_once():
    _discover()
    _sync_identities()

    for peer in get_peers():
        # ── Pull events ──
        try:
            cursor = _last_seen_for_peer(peer)
            resp = httpx.get(f"{peer}/events/since/{cursor}", timeout=5)
            events = resp.json()
            _mark_peer_ok(peer)
            if not events:
                _log_activity("pull_empty", peer)
            else:
                for e in events:
                    e["hops"] = 0
                httpx.post("http://localhost:8000/events/sync", json=events, timeout=5)
                latest = max(e["created_at"] for e in events)
                _update_cursor(peer, latest)
                _log_activity("pull", peer, count=len(events))
                log.info(f"Pulled {len(events)} events from {peer}")
        except Exception as e:
            _mark_peer_fail(peer)
            _log_activity("pull_fail", peer)
            log.warning(f"Pull failed for {peer}: {e}")

        # ── Pull indicators ──
        try:
            cursor = _last_seen_for_peer(f"ind:{peer}")
            resp = httpx.get(f"{peer}/indicators/since/{cursor}", timeout=5)
            indicators = resp.json()
            if indicators:
                for ind in indicators:
                    ind["hops"] = 0
                httpx.post("http://localhost:8000/indicators/sync", json=indicators, timeout=5)
                latest = max(i["created_at"] for i in indicators)
                _update_cursor(f"ind:{peer}", latest)
                log.info(f"Pulled {len(indicators)} indicators from {peer}")
        except Exception:
            pass

        # ── Pull chat messages ──
        try:
            cursor = _last_seen_for_peer(f"chat:{peer}")
            resp = httpx.get(f"{peer}/chat/since/{cursor}", timeout=5)
            messages = resp.json()
            if messages:
                for m in messages:
                    m["hops"] = 0
                httpx.post("http://localhost:8000/chat/sync", json=messages, timeout=5)
                latest = max(m["created_at"] for m in messages)
                _update_cursor(f"chat:{peer}", latest)
                log.info(f"Pulled {len(messages)} chat messages from {peer}")
        except Exception:
            pass


# ── Loop ────────────────────────────────────────────────────────────


def start_gossip_loop():
    def _loop():
        while True:
            time.sleep(SYNC_INTERVAL)
            _sync_once()

    t = threading.Thread(target=_loop, daemon=True)
    t.start()
    log.info(f"Gossip loop started — seeds: {SEED_PEERS}, interval: {SYNC_INTERVAL}s")
