"""Peer identity registry — tracks which peers are trusted in the STK mesh."""

import hashlib
import logging
import secrets
import time

from db import get_db

log = logging.getLogger("identity")


def init_identity_db():
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS peers (
            node_id TEXT PRIMARY KEY,
            company TEXT NOT NULL,
            public_key TEXT NOT NULL,
            public_url TEXT DEFAULT '',
            registered_at TEXT NOT NULL,
            registered_by TEXT DEFAULT 'kraftcert'
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS revocations (
            node_id TEXT PRIMARY KEY,
            company TEXT NOT NULL,
            revoked_at TEXT NOT NULL,
            reason TEXT DEFAULT ''
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS invite_tokens (
            token_hash TEXT PRIMARY KEY,
            company TEXT NOT NULL,
            created_at REAL NOT NULL,
            expires_at REAL NOT NULL,
            used INTEGER DEFAULT 0
        )
    """)
    db.commit()


# ── Invite tokens (KraftCERT only) ─────────────────────────────────


def create_invite(company: str, ttl_seconds: int = 3600) -> str:
    """Generate a single-use invite token for a new peer. Returns the raw token."""
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    now = time.time()
    db = get_db()
    db.execute(
        "INSERT INTO invite_tokens (token_hash, company, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (token_hash, company, now, now + ttl_seconds),
    )
    db.commit()
    log.info(f"Created invite for {company}, expires in {ttl_seconds}s")
    return token


def validate_invite(token: str, company: str) -> bool:
    """Validate and consume an invite token. Returns True if valid."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    db = get_db()
    row = db.execute(
        "SELECT * FROM invite_tokens WHERE token_hash = ?", (token_hash,)
    ).fetchone()

    if not row:
        return False
    if row["used"]:
        return False
    if time.time() > row["expires_at"]:
        return False
    if row["company"] != company:
        return False

    # Mark as used
    db.execute("UPDATE invite_tokens SET used = 1 WHERE token_hash = ?", (token_hash,))
    db.commit()
    return True


# ── Peer registry ──────────────────────────────────────────────────


def register_peer(node_id: str, company: str, public_key: str, registered_by: str = "kraftcert", public_url: str = ""):
    """Add a trusted peer to the registry."""
    from datetime import datetime, timezone
    db = get_db()
    db.execute(
        """INSERT OR REPLACE INTO peers (node_id, company, public_key, public_url, registered_at, registered_by)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (node_id, company, public_key, public_url, datetime.now(timezone.utc).isoformat(), registered_by),
    )
    db.commit()
    log.info(f"Registered peer: {node_id} ({company}) url={public_url}")


def get_peer_identity(node_id: str) -> dict | None:
    """Look up a peer's identity by node_id."""
    db = get_db()
    row = db.execute("SELECT * FROM peers WHERE node_id = ?", (node_id,)).fetchone()
    return dict(row) if row else None


def get_all_peers() -> list[dict]:
    """Return all registered peer identities."""
    db = get_db()
    rows = db.execute("SELECT * FROM peers").fetchall()
    return [dict(r) for r in rows]


def is_trusted(node_id: str) -> bool:
    """Check if a node_id belongs to a registered, non-revoked peer."""
    return get_peer_identity(node_id) is not None and not is_revoked(node_id)


# ── Revocation ─────────────────────────────────────────────────────


def revoke_peer(node_id: str, reason: str = ""):
    """Revoke a peer's trust. Removes from peers, adds to revocations."""
    from datetime import datetime, timezone
    db = get_db()
    peer = get_peer_identity(node_id)
    if not peer:
        return False
    db.execute(
        "INSERT OR REPLACE INTO revocations (node_id, company, revoked_at, reason) VALUES (?, ?, ?, ?)",
        (node_id, peer["company"], datetime.now(timezone.utc).isoformat(), reason),
    )
    db.execute("DELETE FROM peers WHERE node_id = ?", (node_id,))
    db.commit()
    log.info(f"Revoked peer: {node_id} ({peer['company']}) — {reason}")
    return True


def is_revoked(node_id: str) -> bool:
    """Check if a node_id has been revoked."""
    db = get_db()
    row = db.execute("SELECT 1 FROM revocations WHERE node_id = ?", (node_id,)).fetchone()
    return row is not None


def get_revocations() -> list[dict]:
    """Return all revoked peers."""
    db = get_db()
    rows = db.execute("SELECT * FROM revocations").fetchall()
    return [dict(r) for r in rows]


def add_revocation(node_id: str, company: str, revoked_at: str, reason: str):
    """Add a revocation received via gossip."""
    db = get_db()
    db.execute(
        "INSERT OR IGNORE INTO revocations (node_id, company, revoked_at, reason) VALUES (?, ?, ?, ?)",
        (node_id, company, revoked_at, reason),
    )
    db.execute("DELETE FROM peers WHERE node_id = ?", (node_id,))
    db.commit()
